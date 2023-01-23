#ifndef udp_session_hpp
#define udp_session_hpp

#include "cocos/scripting/js-bindings/jswrapper/SeApi.h"

typedef unsigned char const CBYTE;
typedef char const CHARC;

namespace DelayNoMore {
    class UdpSession {
    public:
        static bool upsertPeerUdpAddr(int joinIndex, CHARC* const ip, int port, CHARC* const authKey);
        //static bool clearPeerUDPAddrList();
        //static void punchToServer(CBYTE* const bytes);
        static void onMessage(CBYTE* const bytes);
    };
}
#endif
