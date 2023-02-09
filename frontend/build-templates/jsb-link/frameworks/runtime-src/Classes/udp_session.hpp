#ifndef udp_session_hpp
#define udp_session_hpp

#include "send_ring_buff.hpp"

int const maxPeerCnt = 10;

namespace DelayNoMore {
    class UdpSession {
    public:
        static bool openUdpSession(int port);
        static bool closeUdpSession();
        static bool upsertPeerUdpAddr(struct PeerAddr* newPeerAddrList, int roomCapacity, int selfJoinIndex);
        //static bool clearPeerUDPAddrList();
        static bool punchToServer(CHARC* const srvIp, int const srvPort, BYTEC* const bytes, size_t bytesLen, int const udpTunnelSrvPort, BYTEC* const udpTunnelBytes, size_t udpTunnelBytesBytesLen);
        static bool broadcastInputFrameUpsync(BYTEC* const bytes, size_t bytesLen, int roomCapacity, int selfJoinIndex);
        static bool pollUdpRecvRingBuff();
    };
}
#endif
