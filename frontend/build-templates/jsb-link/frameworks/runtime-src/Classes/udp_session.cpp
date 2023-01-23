#include "udp_session.hpp"
#include "base/ccMacros.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"
#include <stdio.h>

bool DelayNoMore::UdpSession::upsertPeerUdpAddr(int joinIndex, CHARC* const ip, int port, CHARC* const authKey) {
    printf("Called by js for joinIndex=%d, ip=%s, port=%d, authKey=%s.", joinIndex, ip, port, authKey);   
    return true;
}

void DelayNoMore::UdpSession::onMessage(CBYTE* const bytes) {
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
