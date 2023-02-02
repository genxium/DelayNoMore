#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/platform/CCApplication.h"
#include "cocos/base/CCScheduler.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

int const punchServerCnt = 3;
int const punchPeerCnt = 3;
int const broadcastUpsyncCnt = 1;

uv_udp_t *udpRecvSocket = NULL, *udpSendSocket = NULL;
uv_thread_t recvTid, sendTid;
uv_async_t uvRecvLoopStopSig, uvSendLoopStopSig, uvSendLoopTriggerSig;
uv_loop_t *recvLoop = NULL, *sendLoop = NULL;

uv_mutex_t sendRingBuffLock; // used along with "uvSendLoopTriggerSig" as a "uv_cond_t"
SendRingBuff* sendRingBuff = NULL;

char SRV_IP[256];
int SRV_PORT = 0;
int UDP_TUNNEL_SRV_PORT = 0;
struct PeerAddr udpPunchingServerAddr, udpTunnelAddr;
struct PeerAddr peerAddrList[maxPeerCnt];

void _onRead(uv_udp_t* req, ssize_t nread, uv_buf_t const* buf, struct sockaddr const* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }
#if defined(COCOS2D_DEBUG) && (COCOS2D_DEBUG > 0)
    char ip[INET_ADDRSTRLEN];
    memset(ip, 0, sizeof ip);
    int port = 0; 

    if (NULL != addr) {
        // The null check for "addr" is necessary, on Android there'd be such mysterious call to "_onRead"!
        switch (addr->sa_family) {
        case AF_INET: {
            struct sockaddr_in const* sockAddr = (struct sockaddr_in const*)addr;
            uv_inet_ntop(sockAddr->sin_family, &(sockAddr->sin_addr), ip, INET_ADDRSTRLEN);
            port = ntohs(sockAddr->sin_port);
            CCLOG("UDP received %u bytes from %s:%d", nread, ip, port);
            break;
        }
        default:
            break;
        }
    } else {
        CCLOG("UDP received %u bytes from unknown sender", nread);
    }
#endif
    
    if (6 == nread) {
        // holepunching
    } else if (0 < nread) {
        // Non-holepunching; it might be more effective in RAM usage to use a threadsafe RingBuff to pass msg to GameThread here, but as long as it's not a performance blocker don't bother optimize here...
        uint8_t* const ui8Arr = (uint8_t*)malloc(maxUdpPayloadBytes*sizeof(uint8_t));
        memset(ui8Arr, 0, sizeof(ui8Arr));
        for (int i = 0; i < nread; i++) {
            *(ui8Arr+i) = *(buf->base + i);
        }
        cocos2d::Application::getInstance()->getScheduler()->performFunctionInCocosThread([=]() {
            // [WARNING] Use of the "ScriptEngine" is only allowed in "GameThread a.k.a. CocosThread"!
            se::Value onUdpMessageCb;
            se::ScriptEngine::getInstance()->getGlobalObject()->getProperty("onUdpMessage", &onUdpMessageCb);
            // [WARNING] Declaring "AutoHandleScope" is critical here, otherwise "onUdpMessageCb.toObject()" wouldn't be recognized as a function of the ScriptEngine!
            se::AutoHandleScope hs;
            //CCLOG("UDP received %d bytes upsync -- 1", nread);
            se::Object* const gameThreadMsg = se::Object::createTypedArray(se::Object::TypedArrayType::UINT8, ui8Arr, nread);
            //CCLOG("UDP received %d bytes upsync -- 2", nread);
            se::ValueArray args = { se::Value(gameThreadMsg) };
            if (onUdpMessageCb.isObject() && onUdpMessageCb.toObject()->isFunction()) {
                // Temporarily assume that the "this" ptr within callback is NULL.
                bool ok = onUdpMessageCb.toObject()->call(args, NULL);
                if (!ok) {
                    se::ScriptEngine::getInstance()->clearException();
                }
            }
            //CCLOG("UDP received %d bytes upsync -- 3", nread);
            gameThreadMsg->decRef(); // Reference http://docs.cocos.com/creator/2.2/manual/en/advanced-topics/JSB2.0-learning.html#seobject
            //CCLOG("UDP received %d bytes upsync -- 4", nread);
            free(ui8Arr);
            //CCLOG("UDP received %d bytes upsync -- 5", nread);
        });
    }
    free(buf->base);

    /*
    // [WARNING] Don't call either of the following statements! They will make "_onRead" no longer called for incoming packets!
    //uv_udp_recv_stop(req);
    //uv_close((uv_handle_t*)req, NULL);
    */
}

static void _allocBuffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    (void)handle;
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

void _onUvStopSig(uv_async_t* handle) {
    if (!handle) return;
    uv_stop(handle->loop);
    CCLOG("UDP loop %p is signaled to stop in UvXxxxThread", handle->loop);
}

void _afterSend(uv_udp_send_t* req, int status) {
    if (req) {
        free(req);
    }
    if (status) {
        CCLOGERROR("uv_udp_send_cb error: %s\n", uv_strerror(status));
    }
}

void _onUvSthNewToSend(uv_async_t* handle) {
    
    bool hasNext = true;
    while (NULL != handle && true == hasNext) {
        SendWork* work = NULL;
        uv_mutex_lock(&sendRingBuffLock);
        work = sendRingBuff->pop();
                        
        if (NULL == work) {
            hasNext = false;
        }
        /*
        [WARNING] The following "uv_udp_try_send" might block I / O for a long time, hence unlock "as soon as possible" to avoid blocking the "GameThread" which is awaiting to acquire this mutex!
            
        There's a very small chance where "sendRingBuff->put(...)" could contaminate the just popped "work" in "sendRingBuff->eles", thus "sendRingBuff->n" is made quite large to avoid that, moreover in terms of protecting "work" we're also unlocking "as late as possible"!
        */
        uv_mutex_unlock(&sendRingBuffLock);
        if (NULL != work) {
            
            // [WARNING] If "uv_udp_send" is to be used instead of "uv_udp_try_send", as UvSendThread will always be terminated from GameThread, it's a MUST to use the following heap-alloc form to initialize "uv_udp_send_t* req" such that "_afterSend" is guaranteed to be called, otherwise "int uvRunRet2 = uv_run(l, UV_RUN_DEFAULT);" for UvSendThread would block forever due to residual active handles.

            uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
            uv_buf_t sendBuffer = uv_buf_init(work->bytes, work->bytesLen);
            uv_udp_send(req, udpSendSocket, &sendBuffer, 1, (struct sockaddr const*)&(work->peerAddr.sockAddrIn), _afterSend);
            
            //uv_buf_t sendBuffer = uv_buf_init(work->bytes, work->bytesLen);
            //uv_udp_try_send(udpSendSocket, &sendBuffer, 1, (struct sockaddr const*)&(work->peerAddr.sockAddrIn));
#if defined(COCOS2D_DEBUG) && (COCOS2D_DEBUG > 0)
            char ip[INET_ADDRSTRLEN];
            memset(ip, 0, sizeof ip);
            uv_inet_ntop(work->peerAddr.sockAddrIn.sin_family, &(work->peerAddr.sockAddrIn.sin_addr), ip, INET_ADDRSTRLEN);
            int port = ntohs(work->peerAddr.sockAddrIn.sin_port);
            //CCLOG("UDP sent %d bytes to %s:%d", sendBuffer.len, ip, port);
#endif
        }
    }
}

void _onWalkCleanup(uv_handle_t* handle, void* data) {
    (void)data;
    uv_close(handle, NULL);
}

void startRecvLoop(void* arg) {
    uv_udp_recv_start(udpRecvSocket, _allocBuffer, _onRead);

    uv_loop_t* l = (uv_loop_t*)arg;
    int uvRunRet1 = uv_run(l, UV_RUN_DEFAULT);
    CCLOG("UDP recv loop is ended in UvRecvThread, uvRunRet1=%d", uvRunRet1);
    uv_walk(l, _onWalkCleanup, NULL);
    CCLOG("UDP recv loop is walked in UvRecvThread");
    int uvRunRet2 = uv_run(l, UV_RUN_DEFAULT);
    CCLOG("UDP recv loop is run after walking in UvRecvThread, uvRunRet2=%d", uvRunRet2);

    int uvCloseRet = uv_loop_close(l);
    CCLOG("UDP recv loop is closed in UvRecvThread, uvCloseRet=%d", uvCloseRet);
}

void startSendLoop(void* arg) {
    uv_loop_t* l = (uv_loop_t*)arg;
    int uvRunRet1 = uv_run(l, UV_RUN_DEFAULT);
    CCLOG("UDP send loop is ended in UvSendThread, uvRunRet1=%d", uvRunRet1);
    uv_walk(l, _onWalkCleanup, NULL);
    CCLOG("UDP send loop is walked in UvSendThread");
    int uvRunRet2 = uv_run(l, UV_RUN_DEFAULT);
    CCLOG("UDP send loop is run after walking in UvSendThread, uvRunRet2=%d", uvRunRet2);

    int uvCloseRet = uv_loop_close(l);
    CCLOG("UDP send loop is closed in UvSendThread, uvCloseRet=%d", uvCloseRet);
    uv_mutex_destroy(&sendRingBuffLock);
}

bool DelayNoMore::UdpSession::openUdpSession(int port) {
    recvLoop = uv_loop_new();
    udpRecvSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));

    int recvSockInitRes = uv_udp_init(recvLoop, udpRecvSocket); // "uv_udp_init" must precede that of "uv_udp_bind" for successful binding!

    struct sockaddr_in udpAddr;
    uv_ip4_addr("0.0.0.0", port, &udpAddr);
    int bindRes1 = uv_udp_bind(udpRecvSocket, (struct sockaddr const*)&udpAddr, UV_UDP_REUSEADDR);
    if (0 != bindRes1) {
        CCLOGERROR("Failed to bind recv on port=%d; result=%d, reason=%s", port, bindRes1, uv_strerror(bindRes1));
        exit(-1);
    }

    sendLoop = uv_loop_new();
    udpSendSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));
    int sendSockInitRes = uv_udp_init(sendLoop, udpSendSocket); // "uv_udp_init" must precede that of "uv_udp_bind" for successful binding!
    int bindRes2 = uv_udp_bind(udpSendSocket, (struct sockaddr const*)&udpAddr, UV_UDP_REUSEADDR);
    if (0 != bindRes2) {
        CCLOGERROR("Failed to bind send on port=%d; result=%d, reason=%s", port, bindRes2, uv_strerror(bindRes2));
        exit(-1);
    }

    uv_async_init(recvLoop, &uvRecvLoopStopSig, _onUvStopSig);
    uv_mutex_init(&sendRingBuffLock);
    sendRingBuff = new SendRingBuff(maxBuffedMsgs);
    uv_async_init(sendLoop, &uvSendLoopStopSig, _onUvStopSig);
    uv_async_init(sendLoop, &uvSendLoopTriggerSig, _onUvSthNewToSend);

    CCLOG("About to open UDP session at port=%d; bindRes1=%d, bindRes2=%d; recvSockInitRes=%d, sendSocketInitRes=%d; recvLoop=%p, sendLoop=%p...", port, bindRes1, bindRes2, recvSockInitRes, sendSockInitRes, recvLoop, sendLoop);

    uv_thread_create(&recvTid, startRecvLoop, recvLoop);
    uv_thread_create(&sendTid, startSendLoop, sendLoop);

    CCLOG("Finished opening UDP session at port=%d", port);

    return true;
}

bool DelayNoMore::UdpSession::closeUdpSession() {
    CCLOG("About to close udp session and dealloc all resources...");

    uv_async_send(&uvSendLoopStopSig);
    CCLOG("Signaling UvSendThread to end in GameThread...");
    uv_thread_join(&sendTid);
    free(udpSendSocket);
    free(sendLoop);
    delete sendRingBuff;

    uv_async_send(&uvRecvLoopStopSig); // The few if not only guaranteed thread safe utility of libuv :) See http://docs.libuv.org/en/v1.x/async.html#c.uv_async_send
    CCLOG("Signaling UvRecvThread to end in GameThread...");
    uv_thread_join(&recvTid);
    free(udpRecvSocket);
    free(recvLoop);

    for (int i = 0; i < maxPeerCnt; i++) {
        peerAddrList[i].authKey = -1; // hardcoded for now
        memset((char*)&peerAddrList[i].sockAddrIn, 0, sizeof(peerAddrList[i].sockAddrIn));
    }
    CCLOG("Closed udp session and dealloc all resources in GameThread...");

    return true;
}

bool DelayNoMore::UdpSession::punchToServer(CHARC* const srvIp, int const srvPort, BYTEC* const bytes, size_t bytesLen, int const udpTunnelSrvPort, BYTEC* const udpTunnelBytes, size_t udpTunnelBytesBytesLen) {
    memset(SRV_IP, 0, sizeof SRV_IP);
    memcpy(SRV_IP, srvIp, strlen(srvIp));
    SRV_PORT = srvPort;
    UDP_TUNNEL_SRV_PORT = udpTunnelSrvPort;

    struct sockaddr_in udpPunchingServerDestAddr;
    uv_ip4_addr(SRV_IP, SRV_PORT, &udpPunchingServerDestAddr);
    udpPunchingServerAddr.sockAddrIn = udpPunchingServerDestAddr;

    struct sockaddr_in udpTunnelDestAddr;
    uv_ip4_addr(SRV_IP, UDP_TUNNEL_SRV_PORT, &udpTunnelDestAddr);
    udpTunnelAddr.sockAddrIn = udpTunnelDestAddr;

    /*
    Libuv is really inconvenient here, neither "uv_queue_work" nor "uv_async_init" is threadsafe(http ://docs.libuv.org/en/v1.x/threadpool.html#c.uv_queue_work)! What's the point of such a queue? It's even more difficult than writing my own implementation -- again a threadsafe RingBuff could be used to the rescue, yet I'd like to investigate more into how to make the following threadsafe APIs with minimum cross-platform C++ codes
    - _sendMessage(...), should be both non-blocking & threadsafe, called from GameThread
    - _onRead(...), should be called first in UvRecvThread in an edge-triggered manner like idiomatic "epoll" or "kqueue", then dispatch the received message to GameThread by a threadsafe RingBuff
    */ 
    
    uv_mutex_lock(&sendRingBuffLock);
    sendRingBuff->put(bytes, bytesLen, &udpPunchingServerAddr);
    sendRingBuff->put(udpTunnelBytes, udpTunnelBytesBytesLen, &udpTunnelAddr);
    uv_mutex_unlock(&sendRingBuffLock);
    uv_async_send(&uvSendLoopTriggerSig);

    return true;
}

bool DelayNoMore::UdpSession::upsertPeerUdpAddr(struct PeerAddr* newPeerAddrList, int roomCapacity, int selfJoinIndex) {
    // Call timer for multiple sendings from JavaScript?
    CCLOG("upsertPeerUdpAddr called by js for roomCapacity=%d, selfJoinIndex=%d.", roomCapacity, selfJoinIndex);

    uv_mutex_lock(&sendRingBuffLock);
    for (int i = 0; i < roomCapacity; i++) {
        if (i == selfJoinIndex - 1) continue;
        struct PeerAddr* cand = (newPeerAddrList + i);
        if (NULL == cand || 0 == cand->sockAddrIn.sin_port) continue; // Not initialized 
        peerAddrList[i].sockAddrIn = cand->sockAddrIn;
        peerAddrList[i].authKey = cand->authKey;
        sendRingBuff->put("foobar", 6, &(peerAddrList[i])); // Content hardcoded for now
    }
    uv_mutex_unlock(&sendRingBuffLock);
    uv_async_send(&uvSendLoopTriggerSig);

    return true;
}

bool DelayNoMore::UdpSession::broadcastInputFrameUpsync(BYTEC* const bytes, size_t bytesLen, int roomCapacity, int selfJoinIndex) {
    uv_mutex_lock(&sendRingBuffLock); 
    // Might want to send several times for better arrival rate
    for (int j = 0; j < broadcastUpsyncCnt; j++) {
        // Send to room udp tunnel in case of hole punching failure
        sendRingBuff->put(bytes, bytesLen, &udpTunnelAddr);
        for (int i = 0; i < roomCapacity; i++) {
            if (i + 1 == selfJoinIndex) {
                continue;
            }
            if (0 == peerAddrList[i].sockAddrIn.sin_port) {
                // Peer addr not initialized
                continue;
            }

            sendRingBuff->put(bytes, bytesLen, &(peerAddrList[i])); // Content hardcoded for now
        }
    }

    uv_mutex_unlock(&sendRingBuffLock);
    uv_async_send(&uvSendLoopTriggerSig);

    return true;
}
