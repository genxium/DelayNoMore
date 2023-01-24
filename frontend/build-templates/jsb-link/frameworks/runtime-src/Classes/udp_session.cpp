#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/platform/CCApplication.h"
#include "cocos/base/CCScheduler.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"
#include "uv/uv.h"

uv_udp_t* udpSocket = NULL;

uv_loop_t* loop = NULL; // Only this loop is used for this simple PoC

int const sendBufferLen = 1024;
uv_mutex_t sendLock, recvLock;

void _onRead(uv_udp_t* req, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }

    char senderAddrStr[64] = { 0 };
    uv_ip4_name((const struct sockaddr_in*)addr, senderAddrStr, 16);

    //uv_udp_recv_stop(req);

    int const gameThreadMsgSize = 256;
    char* const gameThreadMsg = (char* const)malloc(gameThreadMsgSize);
    memset(gameThreadMsg, 0, gameThreadMsgSize);
    memcpy(gameThreadMsg, buf->base, nread);

    CCLOG("Recv %d bytes from %s, converted to %d bytes for the JS callback", nread, senderAddrStr, strlen(gameThreadMsg));
    free(buf->base);

    cocos2d::Application::getInstance()->getScheduler()->performFunctionInCocosThread([=]() {
        // [WARNING] Use of the "ScriptEngine" is only allowed in "GameThread a.k.a. CocosThread"!
        se::Value onUdpMessageCb;
        se::ScriptEngine::getInstance()->getGlobalObject()->getProperty("onUdpMessage", &onUdpMessageCb);
        // [WARNING] Declaring "AutoHandleScope" is critical here, otherwise "onUdpMessageCb.toObject()" wouldn't be recognized as a function of the ScriptEngine!
        se::AutoHandleScope hs;
        se::ValueArray args = { se::Value(gameThreadMsg) };
        if (onUdpMessageCb.isObject() && onUdpMessageCb.toObject()->isFunction()) {
            bool ok = onUdpMessageCb.toObject()->call(args, NULL /* Temporarily assume that the "this" ptr within callback is NULL. */);
            if (!ok) {
                se::ScriptEngine::getInstance()->clearException();
            }
        }
        free(gameThreadMsg);
    });
}

static void _allocBuffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    (void)handle;
    buf->base = (char *)malloc(suggested_size);
    buf->len = suggested_size;
}

void startRecvLoop(void* arg) {
    uv_loop_t* loop = (uv_loop_t*)arg;
    uv_run(loop, UV_RUN_DEFAULT);
    CCLOG("UDP session is ended!");
}

bool DelayNoMore::UdpSession::openUdpSession(int port) {
    
    uv_mutex_init(&sendLock);
    uv_mutex_init(&recvLock);

    CCLOG("About to open UDP session at port=%d...", port);
    loop = uv_loop_new(); // Only the default loop is used for this simple PoC
    udpSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));
    SOCKADDR_IN recv_addr;
    uv_ip4_addr("0.0.0.0", port, &recv_addr);
    
    uv_udp_init(loop, udpSocket);
    
    uv_udp_bind(udpSocket, (struct sockaddr const*)&recv_addr, UV_UDP_REUSEADDR);
    uv_udp_recv_start(udpSocket, _allocBuffer, _onRead);
    
    uv_thread_t recvTid;
    uv_thread_create(&recvTid, startRecvLoop, loop);

    CCLOG("Finished opening UDP session at port=%d", port);

    return true;
}

static void _onWalkCleanup(uv_handle_t* handle, void* data) {
    (void)data;
    uv_close(handle, NULL);
}

bool DelayNoMore::UdpSession::closeUdpSession() { 
    CCLOG("About to close udp session and dealloc all resources...");
    uv_stop(loop);
    uv_walk(loop, _onWalkCleanup, NULL);
    uv_loop_close(loop);
    free(udpSocket);
    free(loop);

    uv_mutex_destroy(&sendLock);
    uv_mutex_destroy(&recvLock);
    CCLOG("Closed udp session and dealloc all resources...");

    return true;
}

bool DelayNoMore::UdpSession::upsertPeerUdpAddr(int joinIndex, CHARC* const ip, int port, uint32_t authKey) {
    CCLOG("Called by js for joinIndex=%d, ip=%s, port=%d, authKey=%lu.", joinIndex, ip, port, authKey);   
    return true;
}

void _onSend(uv_udp_send_t* req, int status) {
    free(req);
    if (status) {
        fprintf(stderr, "uv_udp_send_cb error: %s\n", uv_strerror(status));
    }
}

bool DelayNoMore::UdpSession::punchToServer(BYTEC* const bytes) {
    /*
    [WARNING] The RAM space used for "bytes", either on stack or in heap, is preallocatedand managed by the caller.
    
    Moreover, there's no need to lock on "bytes". Only "udpSocket" is possibly accessed by multiple threads.
    */
    uv_udp_send_t* req = (uv_udp_send_t*)malloc(sizeof(uv_udp_send_t));
    uv_buf_t sendBuffer = uv_buf_init(bytes, strlen(bytes)); 

    SOCKADDR_IN destAddr;
    uv_ip4_addr("127.0.0.1", 3000, &destAddr);
    uv_mutex_lock(&sendLock);
    uv_udp_send(req, udpSocket, &sendBuffer, 1, (struct sockaddr const*)&destAddr, _onSend);
    uv_mutex_unlock(&sendLock);
    return true;
}