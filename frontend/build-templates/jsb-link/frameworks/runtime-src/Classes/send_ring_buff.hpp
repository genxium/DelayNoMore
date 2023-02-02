#ifndef send_ring_buff_hpp
#define send_ring_buff_hpp

#include "uv/uv.h"
#define __SSIZE_T // Otherwise "ssize_t" would have conflicting macros error that stops compiling

int const RING_BUFF_CONSECUTIVE_SET = 0;
int const RING_BUFF_NON_CONSECUTIVE_SET = 1;
int const RING_BUFF_FAILED_TO_SET = 2;

typedef char BYTEC;
typedef char const CHARC;
int const maxUdpPayloadBytes = 128;
int const maxBuffedMsgs = 512;

struct PeerAddr {
	struct sockaddr_in sockAddrIn;
	uint32_t authKey;
};

class SendWork {
public:
	BYTEC bytes[maxUdpPayloadBytes]; // Wasting some RAM here thus no need for explicit recursive destruction
	size_t bytesLen;
	PeerAddr peerAddr;
};

// [WARNING] This class is specific to "SendWork", designed and implemented only to use in multithreading env and save heap alloc/dealloc timecomplexity, it's by no means comparable to the Golang or JavaScript versions!
class SendRingBuffer {
public:
	int ed, st, n, cnt;
	SendWork eles[maxBuffedMsgs]; // preallocated on stack to save heap alloc/dealloc time
	SendRingBuffer(int newN) {
		this->n = newN;
		this->st = this->ed = this->cnt = 0;
	}

	void put(BYTEC* const newBytes, size_t newBytesLen, PeerAddr* pNewPeerAddr) {
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

	// Sending is always sequential in UvSendThread, no need to return a copy of "SendWork" instance
	SendWork* pop() {
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
};

#endif