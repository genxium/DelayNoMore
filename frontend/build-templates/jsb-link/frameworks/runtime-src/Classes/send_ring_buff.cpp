#include <string.h>
#include "send_ring_buff.hpp"

void SendRingBuff::put(BYTEC* const newBytes, size_t newBytesLen, PeerAddr* pNewPeerAddr) {
    while (0 < cnt && cnt >= n) {
        // Make room for the new element
        this->pop();
    }
    eles[ed].bytesLen = newBytesLen;
    memset(eles[ed].bytes, 0, sizeof eles[ed].bytes);
    memcpy(eles[ed].bytes, newBytes, newBytesLen);
    eles[ed].peerAddr = *(pNewPeerAddr);
    ed++;
    cnt++;
    if (ed >= n) {
        ed -= n; // Deliberately not using "%" operator for performance concern
    }
}

SendWork* SendRingBuff::pop() {
    if (0 == cnt) {
        return NULL;
    }
    SendWork* ret = &(eles[st]);
    cnt--;
    st++;
    if (st >= n) {
        st -= n;
    }
    return ret;
}
