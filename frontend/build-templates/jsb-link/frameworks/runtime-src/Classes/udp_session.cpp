#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"
#include "uv/uv.h"
#include <thread>

static uv_udp_t* udpSocket = NULL;
uv_loop_t* loop = NULL; // Only this loop is used for this simple PoC

void _onRead(uv_udp_t* req, ssize_t nread, const uv_buf_t* buf, const struct sockaddr* addr, unsigned flags) {
    if (nread < 0) {
        CCLOGERROR("Read error %s", uv_err_name(nread));
        uv_close((uv_handle_t*)req, NULL);
        free(buf->base);
        return;
    }

    char sender[17] = { 0 };
    uv_ip4_name((const struct sockaddr_in*)addr, sender, 16);
    CCLOG("Recv from %s", sender);

    free(buf->base);
    uv_udp_recv_stop(req);
}

static void _allocBuffer(uv_handle_t* handle, size_t suggested_size, uv_buf_t* buf) {
    (void)handle;
    buf->base = (char *)malloc(suggested_size);
    buf->len = suggested_size;
}

void startRecvLoop(void* arg) {
    uv_loop_t* loop = (uv_loop_t*)arg;
    uv_run(loop, UV_RUN_DEFAULT);
}

bool DelayNoMore::UdpSession::openUdpSession(int port) {
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
     
    //std::thread([=]() {
    //    udpSocket = (uv_udp_t*)malloc(sizeof(uv_udp_t));
    //    SOCKADDR_IN recv_addr;
    //    uv_ip4_addr("0.0.0.0", port, &recv_addr);
    //
    //    uv_udp_init(loop, udpSocket);
    //
    //    uv_udp_bind(udpSocket, (struct sockaddr const*)&recv_addr, UV_UDP_REUSEADDR);
    //    uv_udp_recv_start(udpSocket, _allocBuffer, _onRead);
    //
    //    startRecvLoop(loop);
    //}).detach();

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
    CCLOG("Closed udp session and dealloc all resources...");

    return true;
}

bool DelayNoMore::UdpSession::upsertPeerUdpAddr(int joinIndex, CHARC* const ip, int port, uint32_t authKey) {
    CCLOG("Called by js for joinIndex=%d, ip=%s, port=%d, authKey=%lu.", joinIndex, ip, port, authKey);   
    return true;
}

void DelayNoMore::UdpSession::onMessage(BYTEC* const bytes) {
    se::ScriptEngine* se = se::ScriptEngine::getInstance();
    
    se::Value func;
    se->getGlobalObject()->getProperty("onUdpMessage", &func);
    
    se::ValueArray args;
    args.push_back(se::Value(bytes));
    if (func.isObject() && func.toObject()->isFunction()) {
        bool ok = func.toObject()->call(args, NULL /* Temporarily assume that the "this" ptr within callback is NULL. */);
        if (!ok) {
            se::ScriptEngine::getInstance()->clearException();
        }
    }
}
