#include "uv/uv.h"
#define __SSIZE_T // Otherwise "ssize_t" would have conflicting macros error that stops compiling

#ifndef udp_session_hpp
#define udp_session_hpp

typedef char BYTEC;
typedef char const CHARC;

int const maxPeerCnt = 10;
struct PeerAddr {
    struct sockaddr_in sockAddrIn;
    uint32_t authKey;
};

namespace DelayNoMore {
    class UdpSession {
    public:
        static bool openUdpSession(int port);
        static bool closeUdpSession();
        static bool upsertPeerUdpAddr(struct PeerAddr* newPeerAddrList, int roomCapacity, int selfJoinIndex);
        //static bool clearPeerUDPAddrList();
        static bool punchToServer(CHARC* const srvIp, int const srvPort, BYTEC* const bytes, size_t bytesLen);
        static bool broadcastInputFrameUpsync(BYTEC* const bytes, size_t bytesLen, int roomCapacity, int selfJoinIndex);
    };
}
#endif
