#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/platform/CCApplication.h"
#include "cocos/base/CCScheduler.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

uv_udp_t* udpSocket = NULL;
uv_thread_t recvTid;
uv_timer_t peerPunchTimer;
uv_async_t uvLoopStopSig;
uv_loop_t* loop = NULL; // Only this loop is used for this simple PoC

struct PeerAddr peerAddrList[maxPeerCnt];

char SRV_IP[256];
int SRV_PORT = 0;

void _onRead(uv_udp_t* req, ssize_t nread, uv_buf_t const* buf, struct sockaddr const* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }
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
            CCLOG("UDP received %d bytes from %s:%d", nread, ip, port);
            break;
        }
        default:
            break;
        }
    } else {
        CCLOG("UDP received %d bytes from unknown sender", nread);
    }
    
    if (6 == nread) {
        // holepunching
    } else if (0 < nread) {
        // Non-holepunching
        uint8_t* const ui8Arr = (uint8_t*)malloc(256*sizeof(uint8_t));
        memset(ui8Arr, 0, sizeof ui8Arr);
        for (int i = 0; i < nread; i++) {
            *(ui8Arr+i) = *(buf->base + i);
        }
        cocos2d::Application::getInstance()->getScheduler()->performFunctionInCocosThread([=]() {
            // [WARNING] Use of the "ScriptEngine" is only allowed in "GameThread a.k.a. CocosThread"!
            se::Value onUdpMessageCb;
            se::ScriptEngine::getInstance()->getGlobalObject()->getProperty("onUdpMessage", &onUdpMessageCb);
            // [WARNING] Declaring "AutoHandleScope" is critical here, otherwise "onUdpMessageCb.toObject()" wouldn't be recognized as a function of the ScriptEngine!
            se::AutoHandleScope hs;
            CCLOG("UDP received %d bytes upsync -- 1", nread);
            se::Object* const gameThreadMsg = se::Object::createTypedArray(se::Object::TypedArrayType::UINT8, ui8Arr, nread);
            CCLOG("UDP received %d bytes upsync -- 2", nread);
            se::ValueArray args = { se::Value(gameThreadMsg) };
            if (onUdpMessageCb.isObject() && onUdpMessageCb.toObject()->isFunction()) {
                // Temporarily assume that the "this" ptr within callback is NULL.
                bool ok = onUdpMessageCb.toObject()->call(args, NULL);
                if (!ok) {
                    se::ScriptEngine::getInstance()->clearException();
                }
            }
            CCLOG("UDP received %d bytes upsync -- 3", nread);
            gameThreadMsg->decRef(); // Reference http://docs.cocos.com/creator/2.2/manual/en/advanced-topics/JSB2.0-learning.html#seobject
            CCLOG("UDP received %d bytes upsync -- 4", nread);
            free(ui8Arr);
            CCLOG("UDP received %d bytes upsync -- 5", nread);

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
    uv_stop(loop);
    CCLOG("UDP recv loop is signaled to stop in UvThread");
}

void _onSend(uv_udp_send_t* req, int status) {
    CCLOG("UDP send about to free req for status:%d...", status);
    free(req); // No need to free "req->base", it'll be handled in each "_afterXxx" callback
    CCLOG("UDP send freed req for status:%d...", status);
    if (status) {
        CCLOGERROR("uv_udp_send_cb error: %s\n", uv_strerror(status));
    }
}

void _onUvTimerClosed(uv_handle_t* timer) {
    free(timer);
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
    CCLOG("UDP send about to free PunchServerWork for status:%d...", status);
    PunchServerWork* work = (PunchServerWork*)wrapper->data;
    delete work;
    CCLOG("UDP freed PunchServerWork for status:%d...", status);
}

class PunchPeerWork {
public:
    int roomCapacity;
    int selfJoinIndex;
    int naiveRefCnt;
    PunchPeerWork(int newRoomCapacity, int newSelfJoinIndex) {
        this->roomCapacity = newRoomCapacity;
        this->selfJoinIndex = newSelfJoinIndex;
        this->naiveRefCnt = 0;
    }
    void refInc() {
        ++this->naiveRefCnt;
    }
    void refDecAndDelIfZero() {
        --this->naiveRefCnt;
        if (0 >= this->naiveRefCnt) {
            delete this;
        }
    }
    virtual ~PunchPeerWork() {
        CCLOG("PunchPeerWork instance deleted...");
    }
};
void _punchPeerOnUvThreadDelayed(uv_timer_t* timer, int status) {
    //CCLOG("_punchPeerOnUvThreadDelayed started...");
    PunchPeerWork* work = (PunchPeerWork*)timer->data;
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
        //CCLOG("UDP about to punch peer joinIndex:%d", i);
        char peerIp[17] = { 0 };
        uv_ip4_name((struct sockaddr_in*)&(peerAddrList[i].sockAddrIn), peerIp, sizeof peerIp);
        int peerPortSt = ntohs(peerAddrList[i].sockAddrIn.sin_port) - 3;
        int peerPortEd = ntohs(peerAddrList[i].sockAddrIn.sin_port) + 3;
        for (int peerPort = peerPortSt; peerPort < peerPortEd; peerPort++) {
            if (0 > peerPort) continue;
            uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
            uv_buf_t sendBuffer = uv_buf_init("foobar", 6); // hardcoded for now
            struct sockaddr_in testPeerAddr;
            uv_ip4_addr(peerIp, peerPort, &testPeerAddr);
            uv_udp_send(req, udpSocket, &sendBuffer, 1, (struct sockaddr const*)&testPeerAddr, _onSend);
            CCLOG("UDP punched peer %s:%d by 6 bytes", peerIp, peerPort);
        }
    }
    uv_timer_stop(timer);
    uv_close((uv_handle_t*)timer, _onUvTimerClosed);
    //CCLOG("_punchPeerOnUvThreadDelayed stopped...");
    work->refDecAndDelIfZero();
}
int const punchPeerCnt = 3;
void _startPunchPeerTimerOnUvThread(uv_work_t* wrapper) {
    PunchPeerWork* work = (PunchPeerWork*)wrapper->data;
    int roomCapacity = work->roomCapacity;
    int selfJoinIndex = work->selfJoinIndex;

    for (int j = 0; j < punchPeerCnt; j++) {
        work->refInc();
    }
    for (int j = 0; j < punchPeerCnt; j++) {
        uv_timer_t* punchTimer = (uv_timer_t*)malloc(sizeof(uv_timer_t)); // I don't think libuv timer is safe to be called from GameThread, thus calling it within UvThread here
        uv_timer_init(loop, punchTimer);
        punchTimer->data = work;
        uv_timer_start(punchTimer, (uv_timer_cb)&_punchPeerOnUvThreadDelayed, j * 500, 0);
    }
}
void _afterPunchPeerTimerStarted(uv_work_t* wrapper, int status) {
    // RAM of PunchPeerWork handled by "naiveRefCnt"
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
int const broadcastUpsyncCnt = 1;
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
        for (int j = 0; j < broadcastUpsyncCnt; j++) {
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
    loop = uv_loop_new();
    udpSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));

    int sockInitRes = uv_udp_init(loop, udpSocket); // "uv_udp_init" must precede that of "uv_udp_bind" for successful binding!

    struct sockaddr_in recv_addr;
    uv_ip4_addr("0.0.0.0", port, &recv_addr);
    int bindRes = uv_udp_bind(udpSocket, (struct sockaddr const*)&recv_addr, UV_UDP_REUSEADDR);
    if (0 != bindRes) {
        CCLOGERROR("Failed to bind port=%d; bind result=%d, reason=%s", port, bindRes, uv_strerror(bindRes));
        exit(-1);
    }

    uv_async_init(loop, &uvLoopStopSig, _onUvStopSig);

    CCLOG("About to open UDP session at port=%d; bind result=%d, sock init result=%d...", port, bindRes, sockInitRes);

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
    uv_queue_work(loop, wrapper, _startPunchPeerTimerOnUvThread, _afterPunchPeerTimerStarted);

    return true;
}

bool DelayNoMore::UdpSession::broadcastInputFrameUpsync(BYTEC* const bytes, size_t bytesLen, int roomCapacity, int selfJoinIndex) {
    BroadcastInputFrameUpsyncWork* work = new BroadcastInputFrameUpsyncWork(bytes, bytesLen, roomCapacity, selfJoinIndex);
    uv_work_t* wrapper = (uv_work_t*)malloc(sizeof(uv_work_t));
    wrapper->data = work;
    uv_queue_work(loop, wrapper, _broadcastInputFrameUpsyncOnUvThread, _afterBroadcastInputFrameUpsync);

    return true;
}
