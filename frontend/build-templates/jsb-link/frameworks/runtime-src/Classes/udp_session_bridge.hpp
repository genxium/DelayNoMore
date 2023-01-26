#ifndef udp_session_bridge_hpp
#define udp_session_bridge_hpp

#pragma once
#include "base/ccConfig.h"
#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

extern se::Object* __jsb_udp_session_proto;
extern se::Class* __jsb_udp_session_class;

bool registerUdpSession(se::Object* obj);

SE_DECLARE_FUNC(openUdpSession);
SE_DECLARE_FUNC(punchToServer);
SE_DECLARE_FUNC(broadcastInputFrameUpsync);
SE_DECLARE_FUNC(closeUdpSession);
SE_DECLARE_FUNC(upsertPeerUdpAddr);

#endif
