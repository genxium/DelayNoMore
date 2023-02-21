#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/platform/CCApplication.h"
#include "cocos/base/CCScheduler.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

int const punchServerCnt = 3;
int const punchPeerCnt = 3;
int const broadcastUpsyncCnt = 2;

uv_udp_t *udpRecvSocket = NULL, *udpSendSocket = NULL;
uv_thread_t recvTid, sendTid;
uv_async_t uvRecvLoopStopSig, uvSendLoopStopSig, uvSendLoopTriggerSig;
uv_loop_t *recvLoop = NULL, *sendLoop = NULL;

uv_mutex_t sendRingBuffLock; // used along with "uvSendLoopTriggerSig" as a "uv_cond_t"
SendRingBuff* sendRingBuff = NULL;

uv_mutex_t recvRingBuffLock;
RecvRingBuff* recvRingBuff = NULL;

char SRV_IP[256];
int SRV_PORT = 0;
int UDP_TUNNEL_SRV_PORT = 0;
struct PeerAddr udpPunchingServerAddr, udpTunnelAddr;
struct PeerAddr peerAddrList[maxPeerCnt];
bool peerPunchedMarks[maxPeerCnt];

void _onRead(uv_udp_t* req, ssize_t nread, uv_buf_t const* buf, struct sockaddr const* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }
    struct sockaddr_in const* sockAddr = (struct sockaddr_in const*)addr;

#if defined(COCOS2D_DEBUG) && (COCOS2D_DEBUG > 0)
    char ip[INET_ADDRSTRLEN];
    memset(ip, 0, sizeof ip);
    int port = 0; 

    if (NULL != addr) {
        // The null check for "addr" is necessary, on Android there'd be such mysterious call to "_onRead"!
        switch (addr->sa_family) {
        case AF_INET: {
            uv_inet_ntop(sockAddr->sin_family, &(sockAddr->sin_addr), ip, INET_ADDRSTRLEN);
            port = ntohs(sockAddr->sin_port);
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
        // Peer holepunching
        for (int i = 0; i < maxPeerCnt; i++) {
            if (peerAddrList[i].sockAddrIn.sin_addr.s_addr != sockAddr->sin_addr.s_addr) continue;
            if (peerAddrList[i].sockAddrIn.sin_port != sockAddr->sin_port) continue;
            peerPunchedMarks[i] = true;
#if defined(COCOS2D_DEBUG) && (COCOS2D_DEBUG > 0)
            CCLOG("UDP received peer-holepunching from %s:%d", ip, port);
#endif
            break;
        }
    } else if (0 < nread) {
        // Non-holepunching; the previously used "cocos2d::Application::getInstance()->getScheduler()->performFunctionInCocosThread(...)" approach was so non-deterministic in terms of the lag till GameThread actually recognizes this latest received packet due to scheduler uncertainty -- and was also heavier in RAM due to lambda usage
#if defined(COCOS2D_DEBUG) && (COCOS2D_DEBUG > 0)
        CCLOG("UDP received %u bytes inputFrameUpsync from %s:%d", nread, ip, port);
#endif
        //uv_mutex_lock(&recvRingBuffLock);
        recvRingBuff->put(buf->base, nread);
        //uv_mutex_unlock(&recvRingBuffLock);
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
            CCLOG("UDP sent %d bytes to %s:%d", sendBuffer.len, ip, port);
#endif
        }
    }
}

void _onWalkCleanup(uv_handle_t* handle, void* data) {
    (void)data;
    uv_close(handle, NULL);
}

void startRecvLoop(void* arg) {
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
}

int initSendLoop(struct sockaddr const* pUdpAddr) {
    sendLoop = uv_loop_new();
    udpSendSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));
    int sendSockInitRes = uv_udp_init(sendLoop, udpSendSocket); // "uv_udp_init" must precede that of "uv_udp_bind" for successful binding!
    int sendBindRes = uv_udp_bind(udpSendSocket, pUdpAddr, UV_UDP_REUSEADDR);
    if (0 != sendBindRes) {
        CCLOGERROR("Failed to bind send; sendSockInitRes=%d, sendBindRes=%d, reason=%s", sendSockInitRes, sendBindRes, uv_strerror(sendBindRes));
        exit(-1);
    }
    uv_mutex_init(&sendRingBuffLock);
    sendRingBuff = new SendRingBuff(maxBuffedMsgs);

    uv_async_init(sendLoop, &uvSendLoopStopSig, _onUvStopSig);
    uv_async_init(sendLoop, &uvSendLoopTriggerSig, _onUvSthNewToSend);

    return sendBindRes;
}

bool initRecvLoop(struct sockaddr const* pUdpAddr) {
    recvLoop = uv_loop_new();
    udpRecvSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));

    int recvSockInitRes = uv_udp_init(recvLoop, udpRecvSocket);
    int recvbindRes = uv_udp_bind(udpRecvSocket, pUdpAddr, UV_UDP_REUSEADDR);
    if (0 != recvbindRes) {
        CCLOGERROR("Failed to bind recv; recvSockInitRes=%d, recvbindRes=%d, reason=%s", recvSockInitRes, recvbindRes, uv_strerror(recvbindRes));
        exit(-1);
    }
    uv_mutex_init(&recvRingBuffLock);
    recvRingBuff = new RecvRingBuff(maxBuffedMsgs);

    uv_udp_recv_start(udpRecvSocket, _allocBuffer, _onRead);
    uv_async_init(recvLoop, &uvRecvLoopStopSig, _onUvStopSig);

    return recvbindRes;
}

bool DelayNoMore::UdpSession::openUdpSession(int port) {
    struct sockaddr_in udpAddr;
    uv_ip4_addr("0.0.0.0", port, &udpAddr);
    struct sockaddr const* pUdpAddr = (struct sockaddr const*)&udpAddr;

    memset(peerPunchedMarks, false, sizeof(peerPunchedMarks));
    for (int i = 0; i < maxPeerCnt; i++) {
        peerAddrList[i].authKey = -1; // hardcoded for now
        memset((char*)&peerAddrList[i].sockAddrIn, 0, sizeof(peerAddrList[i].sockAddrIn));
    }
    /*
    [WARNING] On Android, the libuv documentation of "UV_UDP_REUSEADDR" is true, i.e. only the socket that binds later on the same port will be triggered the recv callback; however on Windows, experiment shows that the exact reverse is true instead.

    It's feasible to use a same socket instance for both receiving and sending in different threads, however not knowing the exact thread-safety concerns for "uv_udp_send/uv_udp_try_send" & "uv recv callback" stops me from doing so, I'd prefer to stick to using different socket instances in different threads. 
    */
#if (CC_TARGET_PLATFORM == CC_PLATFORM_ANDROID)
    initSendLoop(pUdpAddr);
    initRecvLoop(pUdpAddr);
#else
    initRecvLoop(pUdpAddr);
    initSendLoop(pUdpAddr);
#endif
    CCLOG("About to open UDP session at port=%d; recvLoop=%p, sendLoop=%p...", port, recvLoop, sendLoop);

    uv_thread_create(&recvTid, startRecvLoop, recvLoop);
    uv_thread_create(&sendTid, startSendLoop, sendLoop);

    CCLOG("Finished opening UDP session at port=%d", port);

    return true;
}

bool DelayNoMore::UdpSession::closeUdpSession() {
    CCLOG("About to close udp session and dealloc all resources...");
    
    /*
    [WARNING] It's possible that "closeUdpSession" is called when "openUdpSession" was NEVER CALLED, thus we have to avoid program crash in this case.  

    In general one shouldn't just check the state of "sendTid" by whether or not "NULL == sendLoop", but in this particular game, both "openUdpSession" and "closeUdpSession" are only called from "GameThread", no thread-safety concern here, i.e. if "openUdpSession" was ever called earlier, then "sendLoop" wouldn't be NULL when "closeUdpSession" is later called.
    */
    if (NULL != sendLoop) {
        uv_async_send(&uvSendLoopStopSig);
        CCLOG("Signaling UvSendThread to end in GameThread...");
        uv_thread_join(&sendTid);
        free(udpSendSocket);
        free(sendLoop);
        delete sendRingBuff;
        
        udpSendSocket = NULL;
        sendLoop = NULL;
        sendRingBuff = NULL;

        uv_mutex_destroy(&sendRingBuffLock);
    }

    if (NULL != recvLoop) {
        uv_async_send(&uvRecvLoopStopSig); // The few if not only guaranteed thread safe utility of libuv :) See http://docs.libuv.org/en/v1.x/async.html#c.uv_async_send
        CCLOG("Signaling UvRecvThread to end in GameThread...");
        uv_thread_join(&recvTid);
        free(udpRecvSocket);
        free(recvLoop);
        delete recvRingBuff;

        udpRecvSocket = NULL;
        recvLoop = NULL;
        recvRingBuff = NULL;

        uv_mutex_destroy(&recvRingBuffLock);
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
        int peerPunchedCnt = 0;
        for (int i = 0; i < roomCapacity; i++) {
            if (i + 1 == selfJoinIndex) {
                continue;
            }
            if (0 == peerAddrList[i].sockAddrIn.sin_port) {
                // Peer addr not initialized
                continue;
            }
            if (false == peerPunchedMarks[i]) {
                // Not punched yet, save some bandwidth
                continue;
            }
            sendRingBuff->put(bytes, bytesLen, &(peerAddrList[i]));
            ++peerPunchedCnt;
        }

        if (peerPunchedCnt + 1 < roomCapacity) {
            // Send to room udp tunnel in case of ANY hole punching failure
            sendRingBuff->put(bytes, bytesLen, &udpTunnelAddr);
        }
    }

    uv_mutex_unlock(&sendRingBuffLock);
    uv_async_send(&uvSendLoopTriggerSig);

    return true;
}

bool DelayNoMore::UdpSession::pollUdpRecvRingBuff() {
    // This function is called by GameThread 60 fps.

    //uv_mutex_lock(&recvRingBuffLock);
    while (true) {
        RecvWork f;
        bool res = recvRingBuff->pop(&f); 
        if (!res) {
            // Deliberately returning "true" here to prevent "jswrapper" from printing "Failed to invoke Xxx..." too frequently
            return true;
        }
        // [WARNING] Declaring "AutoHandleScope" is critical here, otherwise "onUdpMessageCb.toObject()" wouldn't be recognized as a function of the ScriptEngine!
        se::AutoHandleScope hs;
        // [WARNING] Use of the "ScriptEngine" is only allowed in "GameThread a.k.a. CocosThread"!
        se::Value onUdpMessageCb;
        se::ScriptEngine::getInstance()->getGlobalObject()->getProperty("onUdpMessage", &onUdpMessageCb);
        if (onUdpMessageCb.isObject() && onUdpMessageCb.toObject()->isFunction()) {
            //CCLOG("UDP received %d bytes upsync -- 1", nread);
            se::Object* const gameThreadMsg = se::Object::createTypedArray(se::Object::TypedArrayType::UINT8, f.ui8Arr, f.bytesLen);
            //CCLOG("UDP received %d bytes upsync -- 2", nread);
            se::ValueArray args = { se::Value(gameThreadMsg) };

            // Temporarily assume that the "this" ptr within callback is NULL.
            bool ok = onUdpMessageCb.toObject()->call(args, NULL);
            if (!ok) {
                se::ScriptEngine::getInstance()->clearException();
            }
            //CCLOG("UDP received %d bytes upsync -- 3", nread);
            gameThreadMsg->decRef(); // Reference http://docs.cocos.com/creator/2.2/manual/en/advanced-topics/JSB2.0-learning.html#seobject
            //CCLOG("UDP received %d bytes upsync -- 4", nread);
        }
    }
    //uv_mutex_unlock(&recvRingBuffLock);
    return true;
}
