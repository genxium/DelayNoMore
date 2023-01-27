#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/platform/CCApplication.h"
#include "cocos/base/CCScheduler.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

uv_udp_t* udpSocket = NULL;
uv_thread_t recvTid;
uv_async_t uvLoopStopSig;
uv_loop_t* loop = NULL; // Only this loop is used for this simple PoC

struct PeerAddr peerAddrList[maxPeerCnt];

char SRV_IP[256];
int SRV_PORT = 0;

void _onRead(uv_udp_t* req, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }

    struct sockaddr_in* sockAddr = (struct sockaddr_in*)addr;
    char ip[17] = { 0 };
    uv_ip4_name(sockAddr, ip, sizeof ip);
    int port = ntohs(sockAddr->sin_port);

    int const gameThreadMsgSize = 256;
    char* const gameThreadMsg = (char* const)malloc(gameThreadMsgSize);
    memset(gameThreadMsg, 0, gameThreadMsgSize);
    memcpy(gameThreadMsg, buf->base, nread);

    CCLOG("UDP read %d bytes from %s:%d, converted to %d bytes for the JS callback", nread, ip, port, strlen(gameThreadMsg));
    free(buf->base);
    //uv_udp_recv_stop(req);

    cocos2d::Application::getInstance()->getScheduler()->performFunctionInCocosThread([=]() {
        // [WARNING] Use of the "ScriptEngine" is only allowed in "GameThread a.k.a. CocosThread"!
        se::Value onUdpMessageCb;
        se::ScriptEngine::getInstance()->getGlobalObject()->getProperty("onUdpMessage", &onUdpMessageCb);
        // [WARNING] Declaring "AutoHandleScope" is critical here, otherwise "onUdpMessageCb.toObject()" wouldn't be recognized as a function of the ScriptEngine!
        se::AutoHandleScope hs;
        se::ValueArray args = { se::Value(gameThreadMsg) };
        if (onUdpMessageCb.isObject() && onUdpMessageCb.toObject()->isFunction()) {
            // Temporarily assume that the "this" ptr within callback is NULL.
            bool ok = onUdpMessageCb.toObject()->call(args, NULL);
            if (!ok) {
                se::ScriptEngine::getInstance()->clearException();
            }
        }
        free(gameThreadMsg);
    });
}

static void _allocBuffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    (void)handle;
    buf->base = (char*)malloc(suggested_size);
    buf->len = suggested_size;
}

void _onUvStopSig(uv_async_t* handle) {
    uv_stop(loop);
    CCLOG("UDP recv loop is signaled to stop in UvThread");
}

void _onSend(uv_udp_send_t* req, int status) {
    free(req); // No need to free "req->base", it'll be handled in each "_afterXxx" callback
    if (status) {
        CCLOGERROR("uv_udp_send_cb error: %s\n", uv_strerror(status));
    }
}
class PunchServerWork {
public:
    BYTEC bytes[128]; // Wasting some RAM here thus no need for explicit recursive destruction
    size_t bytesLen;

    PunchServerWork(BYTEC* const newBytes, size_t newBytesLen) {
        memset(this->bytes, 0, sizeof(this->bytes));
        memcpy(this->bytes, newBytes, newBytesLen);

        this->bytesLen = newBytesLen;
    }
};
void _punchServerOnUvThread(uv_work_t* wrapper) {
    PunchServerWork* work = (PunchServerWork*)wrapper->data;
    uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
    uv_buf_t sendBuffer = uv_buf_init(work->bytes, work->bytesLen);
    struct sockaddr_in destAddr;
    uv_ip4_addr(SRV_IP, SRV_PORT, &destAddr);
    uv_udp_send(req, udpSocket, &sendBuffer, 1, (struct sockaddr const*)&destAddr, _onSend);
}
void _afterPunchServer(uv_work_t* wrapper, int status) {
    PunchServerWork* work = (PunchServerWork*)wrapper->data;
    delete work;
}

class PunchPeerWork {
public:
    int roomCapacity;
    int selfJoinIndex;
    PunchPeerWork(int newRoomCapacity, int newSelfJoinIndex) {
        this->roomCapacity = newRoomCapacity;
        this->selfJoinIndex = newSelfJoinIndex;
    }
};
void _punchPeerOnUvThread(uv_work_t* wrapper) {
    PunchPeerWork* work = (PunchPeerWork*)wrapper->data;
    int roomCapacity = work->roomCapacity;
    int selfJoinIndex = work->selfJoinIndex;
    for (int i = 0; i < roomCapacity; i++) {
        if (i + 1 == selfJoinIndex) {
            continue;
        }
        if (0 == peerAddrList[i].sockAddrIn.sin_port) {
            // Peer addr not initialized
            continue;
        }
        char peerIp[17] = { 0 };
        uv_ip4_name((struct sockaddr_in*)&(peerAddrList[i].sockAddrIn), peerIp, sizeof peerIp);
        for (int j = 0; j < 3; j++) {
            uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
            uv_buf_t sendBuffer = uv_buf_init("foobar", 6); // hardcoded for now
            uv_udp_send(req, udpSocket, &sendBuffer, 1, (struct sockaddr const*)&peerAddrList[i], _onSend);
            CCLOG("UDP punched peer %s:%d by 6 bytes round-%d", peerIp, ntohs(peerAddrList[i].sockAddrIn.sin_port), j);
        }
    }
}
void _afterPunchPeer(uv_work_t* wrapper, int status) {
    PunchPeerWork* work = (PunchPeerWork*)wrapper->data;
    delete work;
}

class BroadcastInputFrameUpsyncWork {
public:
    BYTEC bytes[128]; // Wasting some RAM here thus no need for explicit recursive destruction
    size_t bytesLen;
    int roomCapacity;
    int selfJoinIndex;

    BroadcastInputFrameUpsyncWork(BYTEC* const newBytes, size_t newBytesLen, int newRoomCapacity, int newSelfJoinIndex) {
        memset(this->bytes, 0, sizeof(this->bytes));
        memcpy(this->bytes, newBytes, newBytesLen);

        this->bytesLen = newBytesLen;

        this->roomCapacity = newRoomCapacity;
        this->selfJoinIndex = newSelfJoinIndex;
    }
};
void _broadcastInputFrameUpsyncOnUvThread(uv_work_t* wrapper) {
    BroadcastInputFrameUpsyncWork* work = (BroadcastInputFrameUpsyncWork*)wrapper->data;
    int roomCapacity = work->roomCapacity;
    int selfJoinIndex = work->selfJoinIndex;
    for (int i = 0; i < roomCapacity; i++) {
        if (i + 1 == selfJoinIndex) {
            continue;
        }
        if (0 == peerAddrList[i].sockAddrIn.sin_port) {
            // Peer addr not initialized
            continue;
        }
        char peerIp[17] = { 0 };
        uv_ip4_name((struct sockaddr_in*)&(peerAddrList[i].sockAddrIn), peerIp, sizeof peerIp);
        // Might want to send several times for better arrival rate
        for (int j = 0; j < 1; j++) {
            uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
            uv_buf_t sendBuffer = uv_buf_init(work->bytes, work->bytesLen);
            uv_udp_send(req, udpSocket, &sendBuffer, 1, (struct sockaddr const*)&peerAddrList[i], _onSend);
            CCLOG("UDP broadcasted upsync to peer %s:%d by %u bytes round-%d", peerIp, ntohs(peerAddrList[i].sockAddrIn.sin_port), work->bytesLen, j);
        }
    }
}
void _afterBroadcastInputFrameUpsync(uv_work_t* wrapper, int status) {
    BroadcastInputFrameUpsyncWork* work = (BroadcastInputFrameUpsyncWork*)wrapper->data;
    delete work;
}

void _onWalkCleanup(uv_handle_t* handle, void* data) {
    (void)data;
    uv_close(handle, NULL);
}

void startRecvLoop(void* arg) {
    uv_loop_t* l = (uv_loop_t*)arg;
    int uvRunRet1 = uv_run(l, UV_RUN_DEFAULT);
    CCLOG("UDP recv loop is ended in UvThread, uvRunRet1=%d", uvRunRet1);
    uv_walk(l, _onWalkCleanup, NULL);
    int uvRunRet2 = uv_run(l, UV_RUN_DEFAULT);

    int uvCloseRet = uv_loop_close(l);
    CCLOG("UDP recv loop is closed in UvThread, uvRunRet2=%d, uvCloseRet=%d", uvRunRet2, uvCloseRet);
}

bool DelayNoMore::UdpSession::openUdpSession(int port) {

    udpSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));
    struct sockaddr_in recv_addr;
    uv_ip4_addr("0.0.0.0", port, &recv_addr);
    uv_udp_bind(udpSocket, (struct sockaddr const*)&recv_addr, UV_UDP_REUSEADDR);

    CCLOG("About to open UDP session at port=%d...", port);
    loop = uv_loop_new();
    uv_udp_init(loop, udpSocket);
    uv_async_init(loop, &uvLoopStopSig, _onUvStopSig);

    uv_udp_recv_start(udpSocket, _allocBuffer, _onRead);

    uv_thread_create(&recvTid, startRecvLoop, loop);

    CCLOG("Finished opening UDP session at port=%d", port);

    return true;
}

bool DelayNoMore::UdpSession::closeUdpSession() {
    CCLOG("About to close udp session and dealloc all resources...");

    for (int i = 0; i < maxPeerCnt; i++) {
        peerAddrList[i].authKey = -1; // hardcoded for now
        memset((char*)&peerAddrList[i].sockAddrIn, 0, sizeof(peerAddrList[i].sockAddrIn));
    }
    uv_async_send(&uvLoopStopSig); // The few if not only guaranteed thread safe utility of libuv :) See http://docs.libuv.org/en/v1.x/async.html#c.uv_async_send
    CCLOG("Signaling UvThread to end in GameThread...");

    uv_thread_join(&recvTid);

    free(udpSocket);
    free(loop);

    CCLOG("Closed udp session and dealloc all resources in GameThread...");

    return true;
}

bool DelayNoMore::UdpSession::punchToServer(CHARC* const srvIp, int const srvPort, BYTEC* const bytes, size_t bytesLen) {
    /*
    [WARNING] The RAM space used for "bytes", either on stack or in heap, is preallocatedand managed by the caller which runs on the GameThread. Actual sending will be made on UvThread.

    Therefore we make a copy of this message before dispatching it "GameThread -> UvThread".
    */
    memset(SRV_IP, 0, sizeof SRV_IP);
    memcpy(SRV_IP, srvIp, strlen(srvIp));
    SRV_PORT = srvPort;
    PunchServerWork* work = new PunchServerWork(bytes, bytesLen);
    uv_work_t* wrapper = (uv_work_t*)malloc(sizeof(uv_work_t));
    wrapper->data = work;
    uv_queue_work(loop, wrapper, _punchServerOnUvThread, _afterPunchServer);

    return true;
}

bool DelayNoMore::UdpSession::upsertPeerUdpAddr(struct PeerAddr* newPeerAddrList, int roomCapacity, int selfJoinIndex) {
    CCLOG("upsertPeerUdpAddr called by js for roomCapacity=%d, selfJoinIndex=%d.", roomCapacity, selfJoinIndex);

    // Punching between existing peer-pairs for Address/Port-restricted Cone NAT (not need for Full Cone NAT); UvThread never writes into "peerAddrList", so I assume that it's safe to skip locking for them
    for (int i = 0; i < roomCapacity; i++) {
        if (i == selfJoinIndex - 1) continue;
        peerAddrList[i].sockAddrIn = (*(newPeerAddrList + i)).sockAddrIn;
        peerAddrList[i].authKey = (*(newPeerAddrList + i)).authKey;
    }

    PunchPeerWork* work = new PunchPeerWork(roomCapacity, selfJoinIndex);
    uv_work_t* wrapper = (uv_work_t*)malloc(sizeof(uv_work_t));
    wrapper->data = work;
    uv_queue_work(loop, wrapper, _punchPeerOnUvThread, _afterPunchPeer);

    return true;
}

bool DelayNoMore::UdpSession::broadcastInputFrameUpsync(BYTEC* const bytes, size_t bytesLen, int roomCapacity, int selfJoinIndex) {
    BroadcastInputFrameUpsyncWork* work = new BroadcastInputFrameUpsyncWork(bytes, bytesLen, roomCapacity, selfJoinIndex);
    uv_work_t* wrapper = (uv_work_t*)malloc(sizeof(uv_work_t));
    wrapper->data = work;
    uv_queue_work(loop, wrapper, _broadcastInputFrameUpsyncOnUvThread, _afterBroadcastInputFrameUpsync);

    return true;
}