#ifndef udp_session_hpp
#define udp_session_hpp

#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

typedef char BYTEC;
typedef char const CHARC;

namespace DelayNoMore {
    class UdpSession {
    public:
        static bool openUdpSession(int port);
        static bool closeUdpSession();
        static bool upsertPeerUdpAddr(int joinIndex, CHARC* const ip, int port, uint32_t authKey);
        //static bool clearPeerUDPAddrList();
        static bool punchToServer(BYTEC* const bytes);
        static void onMessage(BYTEC* const bytes);
    };
}
#endif
