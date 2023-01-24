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
    if (1 == argc && args[0].isObject() && args[0].toObject()->isTypedArray()) {
        SE_PRECONDITION2(ok, false, "punchToServer: Error processing arguments");
        BYTEC bytes[1024];
        memset(bytes, 0, sizeof bytes);
        se::Object* obj = args[0].toObject();
        size_t sz = 0;
        uint8_t* ptr;
        obj->getTypedArrayData(&ptr, &sz);
        memcpy(bytes, ptr, sz);
        CCLOG("Should punch by %d bytes v.s. strlen(bytes)=%u.", sz, strlen(bytes));
        return DelayNoMore::UdpSession::punchToServer(bytes);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 1);
    return false;
}
SE_BIND_FUNC(punchToServer)

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

bool upsertPeerUdpAddr(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (4 == argc && args[0].isNumber() && args[1].isString() && args[2].isNumber() && args[3].isNumber()) {
        SE_PRECONDITION2(ok, false, "upsertPeerUdpAddr: Error processing arguments");
        int joinIndex = args[0].toInt32();
        CHARC* ip = args[1].toString().c_str();
        int port = args[2].toInt32();
        uint32_t authKey = args[3].toUint32();
        return DelayNoMore::UdpSession::upsertPeerUdpAddr(joinIndex, ip, port, authKey);
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d; or wrong arg type!", (int)argc, 4);
    
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
