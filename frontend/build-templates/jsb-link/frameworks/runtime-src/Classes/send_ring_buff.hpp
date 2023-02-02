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
class SendRingBuff {
public:
	int ed, st, n, cnt;
	SendWork eles[maxBuffedMsgs]; // preallocated on stack to save heap alloc/dealloc time
	SendRingBuff(int newN) {
		this->n = newN;
		this->st = this->ed = this->cnt = 0;
	}

	void put(BYTEC* const newBytes, size_t newBytesLen, PeerAddr* pNewPeerAddr); 

	// Sending is always sequential in UvSendThread, no need to return a copy of "SendWork" instance
	SendWork* pop();
};

#endif
