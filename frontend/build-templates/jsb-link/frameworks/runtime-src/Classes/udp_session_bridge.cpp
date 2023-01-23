#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "scripting/js-bindings/manual/jsb_conversions.hpp"

bool upsertPeerUdpAddr(se::State& s) {
    const auto& args = s.args();
    size_t argc = args.size();
    CC_UNUSED bool ok = true;
    if (4 == argc) {
        SE_PRECONDITION2(ok, false, "upsertPeerUdpAddr: Error processing arguments");
        int joinIndex = args[0].toInt32();
        CHARC* ip = args[1].toString().c_str();
        int port = args[2].toInt32();
        CHARC* authKey = args[3].toString().c_str();
        DelayNoMore::UdpSession::upsertPeerUdpAddr(joinIndex, ip, port, authKey);
        return true;
    }
    SE_REPORT_ERROR("wrong number of arguments: %d, was expecting %d", (int)argc, 4);
    
    return true;
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
bool register_udp_session(se::Object* obj)
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
    
    cls->defineStaticFunction("upsertPeerUdpAddr", _SE(upsertPeerUdpAddr));
    cls->defineFinalizeFunction(_SE(udpSessionFinalize));
    cls->install();
    
    JSBClassType::registerClass<DelayNoMore::UdpSession>(cls);
    __jsb_udp_session_proto = cls->getProto();
    __jsb_udp_session_class = cls;
    se::ScriptEngine::getInstance()->clearException();
    return true;
}
