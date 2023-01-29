#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "scripting/js-bindings/manual/jsb_conversions.hpp"

bool openUdpSession(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (1 == argc && args[0].isNumber()) {
        SE_PRECONDITION2(ok, false, "openUdpSession: Error processing arguments");
        int port = args[0].toInt32();

        return DelayNoMore::UdpSession::openUdpSession(port);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 1);

    return false;
}
SE_BIND_FUNC(openUdpSession)

bool punchToServer(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (5 == argc && args[0].isString() && args[1].isNumber() && args[2].isObject() && args[2].toObject()->isTypedArray()
        && args[3].isNumber() && args[4].isObject() && args[4].toObject()->isTypedArray()
        ) {
        SE_PRECONDITION2(ok, false, "punchToServer: Error processing arguments");
        CHARC* srvIp = args[0].toString().c_str();
        int srvPort = args[1].toInt32();
        BYTEC bytes[1024];
        memset(bytes, 0, sizeof bytes);
        se::Object* obj = args[2].toObject();
        size_t sz = 0;
        uint8_t* ptr = NULL;
        obj->getTypedArrayData(&ptr, &sz);
        for (size_t i = 0; i < sz; i++) {
            bytes[i] = (char)(*(ptr + i));
        }

        int udpTunnelSrvPort = args[3].toInt32();
        BYTEC udpTunnelBytes[1024];
        memset(udpTunnelBytes, 0, sizeof udpTunnelBytes);
        se::Object* udpTunnelObj = args[4].toObject();
        size_t udpTunnelSz = 0;
        uint8_t* udpTunnelPtr = NULL;
        obj->getTypedArrayData(&udpTunnelPtr, &udpTunnelSz);
        for (size_t i = 0; i < udpTunnelSz; i++) {
            udpTunnelBytes[i] = (char)(*(udpTunnelPtr + i));
        }

        CCLOG("Should punch %s:%d by %d bytes; should punch udp tunnel %s:%d by %d bytes.", srvIp, srvPort, sz, srvIp, udpTunnelSrvPort, udpTunnelSz);
        return DelayNoMore::UdpSession::punchToServer(srvIp, srvPort, bytes, sz, udpTunnelSrvPort, udpTunnelBytes, udpTunnelSz);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 5);
    return false;
}
SE_BIND_FUNC(punchToServer)

bool broadcastInputFrameUpsync(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (3 == argc && args[0].toObject()->isTypedArray() && args[1].isNumber() && args[2].isNumber()) {
        SE_PRECONDITION2(ok, false, "broadcastInputFrameUpsync: Error processing arguments");
        BYTEC bytes[1024];
        memset(bytes, 0, sizeof bytes);
        se::Object* obj = args[0].toObject();
        size_t sz = 0;
        uint8_t* ptr = NULL;
        obj->getTypedArrayData(&ptr, &sz);
        for (size_t i = 0; i < sz; i++) {
            bytes[i] = (char)(*(ptr + i));
        }
        int roomCapacity = args[1].toInt32();
        int selfJoinIndex = args[2].toInt32();
        CCLOG("Should broadcastInputFrameUpsync %u bytes; roomCapacity=%d, selfJoinIndex=%d.", sz, roomCapacity, selfJoinIndex);
        return DelayNoMore::UdpSession::broadcastInputFrameUpsync(bytes, sz, roomCapacity, selfJoinIndex);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 3);
    return false;
}
SE_BIND_FUNC(broadcastInputFrameUpsync)

bool closeUdpSession(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (0 == argc) {
        SE_PRECONDITION2(ok, false, "closeUdpSession: Error processing arguments");
        return DelayNoMore::UdpSession::closeUdpSession();
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 0);

    return false;
}
SE_BIND_FUNC(closeUdpSession)

struct PeerAddr newPeerAddrList[maxPeerCnt];
bool upsertPeerUdpAddr(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (3 == argc && args[0].isObject() && args[0].toObject()->isArray() && args[1].isNumber() && args[2].isNumber()) {
        SE_PRECONDITION2(ok, false, "upsertPeerUdpAddr: Error processing arguments");
        int roomCapacity = args[1].toInt32();
        int selfJoinIndex = args[2].toInt32();
        se::Object* newPeerAddrValArr = args[0].toObject();
        for (int i = 0; i < roomCapacity; i++) {
            se::Value newPeerAddrVal;
            newPeerAddrValArr->getArrayElement(i, &newPeerAddrVal);
            se::Object* newPeerAddrObj = newPeerAddrVal.toObject();
            se::Value newIp, newPort, newAuthKey;
            newPeerAddrObj->getProperty("ip", &newIp);
            newPeerAddrObj->getProperty("port", &newPort);
            newPeerAddrObj->getProperty("authKey", &newAuthKey);
            uv_ip4_addr(newIp.toString().c_str(), newPort.toInt32(), &(newPeerAddrList[i].sockAddrIn));
            newPeerAddrList[i].authKey = newAuthKey.toInt32();
        }

        return DelayNoMore::UdpSession::upsertPeerUdpAddr(newPeerAddrList, roomCapacity, selfJoinIndex);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 3);
    
    return false;
}
SE_BIND_FUNC(upsertPeerUdpAddr)

static bool udpSessionFinalize(se::State& s)
{
    CCLOGINFO("jsbindings: finalizing JS object %p (DelayNoMore::UdpSession)", s.nativeThisObject());
    auto iter = se::NonRefNativePtrCreatedByCtorMap::find(s.nativeThisObject());
    if (iter != se::NonRefNativePtrCreatedByCtorMap::end()) {
        se::NonRefNativePtrCreatedByCtorMap::erase(iter);
        DelayNoMore::UdpSession* cobj = (DelayNoMore::UdpSession*)s.nativeThisObject();
        delete cobj;
    }
    return true;
}
SE_BIND_FINALIZE_FUNC(udpSessionFinalize)

se::Object* __jsb_udp_session_proto = nullptr;
se::Class* __jsb_udp_session_class = nullptr;
bool registerUdpSession(se::Object* obj)
{
    // Get the ns
    se::Value nsVal;
    if (!obj->getProperty("DelayNoMore", &nsVal))
    {
        se::HandleObject jsobj(se::Object::createPlainObject());
        nsVal.setObject(jsobj);
        obj->setProperty("DelayNoMore", nsVal);
    }
    
    se::Object* ns = nsVal.toObject();
    auto cls = se::Class::create("UdpSession", ns, nullptr, nullptr);

    cls->defineStaticFunction("openUdpSession", _SE(openUdpSession));
    cls->defineStaticFunction("punchToServer", _SE(punchToServer));
    cls->defineStaticFunction("broadcastInputFrameUpsync", _SE(broadcastInputFrameUpsync));
    cls->defineStaticFunction("closeUdpSession", _SE(closeUdpSession));
    cls->defineStaticFunction("upsertPeerUdpAddr", _SE(upsertPeerUdpAddr));
    cls->defineFinalizeFunction(_SE(udpSessionFinalize));
    cls->install();
    
    JSBClassType::registerClass<DelayNoMore::UdpSession>(cls);
    __jsb_udp_session_proto = cls->getProto();
    __jsb_udp_session_class = cls;
    se::ScriptEngine::getInstance()->clearException();
    return true;
}
