#include <string.h>
#include "ring_buff.hpp"

// Sending
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

// Recving
bool isFullWithLoadedVals(int n, int oldCnt, int oldSt, int oldEd) {
    return (n <= oldCnt && oldEd == oldSt) || (n > oldCnt && 0 < oldCnt && oldEd == oldSt); 
}

void RecvRingBuff::put(char* newBytes, size_t newBytesLen) {
    RecvWork* slotEle = (&eles[ed.load()]); // Save for later update

    // "RecvRingBuff.ed" is only accessed in "UvRecvThread", thus the order of it relative to the other two is not important.
    int oldEd = ed.load();

    // We want to increase the success rate of "pop()" if it's being executed by "GameThread/pollUdpRecvRingBuff", thus the below order of loading is IMPORTANT, i.e. load "cnt" first because it's decremented earlier than "st" being incremented.
    int oldCnt = cnt.load();
    /*
    [WARNING]
    
    Note that "RecvRingBuff.st" might have decremented in "GameThread" by a successful "pop()" between "cnt.load()" and "st.load()" here in "UvRecvThread"! Therefore "n <= oldCnt" doesn't necessarily imply "oldEd == oldSt"!
    */
    int oldSt = st.load(); // Used to guard against "cnt decremented in pop(...), but st not yet incremented and thus return value not yet copied to avoid contamination"
    int tried = 0;
    /*
    1. When "n <= oldCnt", it might still be true "oldEd != oldSt" (see the note above); 
    2. When "n > oldCnt", it might still be true that "oldEd == oldSt" if "pop()" hasn't successfully incremented "st" due to any reason; 
    3. When "oldEd == oldSt", it doesn't imply anything useful, because any of the following could be true 
        - a. "n <= oldCnt", i.e. the ringbuff is full 
        - b. "n > oldCnt && 0 < oldCnt" during the execution of "pop()", i.e. the ringbuff is still effectively full
        - c. "n > oldCnt && 0 == oldCnt", i.e. the ringbuff is empty
    */
    bool isFull = isFullWithLoadedVals(n, oldCnt, oldSt, oldEd); 
    while (isFull && 3 > tried) {
        // Make room for the new element
        this->pop(NULL);
        oldCnt = cnt.load(); // If "pop()" above failed, it'd only be due to concurrent calls to "pop()", either way the updated "cnt" should be good to go
        oldSt = st.load();
        isFull = isFullWithLoadedVals(n, oldCnt, oldSt, oldEd); 
        ++tried;
    }
    if (isFull && 3 == tried) {
        // Failed silently, UDP packet can be dropped.
        return;
    }
    slotEle->bytesLen = newBytesLen;
    memset(slotEle->ui8Arr, 0, sizeof slotEle->ui8Arr);
    for (size_t i = 0; i < newBytesLen; i++) {
        *(slotEle->ui8Arr + i) = *(newBytes + i);
    }

    // No need to compare-and-swap, only "UvRecvThread" will access "RecvRingBuff.ed".
    int newEd = oldEd+1;
    if (newEd >= n) {
        newEd -= n; // Deliberately not using "%" operator for performance concern
    }

    ed.compare_exchange_weak(oldEd, newEd); // Definitely succeeds because "RecvRingBuff.ed" is only accessed in "UvRecvThread" 

    // Only increment cnt when the putting of new element is fully done.
    cnt++;
}

bool RecvRingBuff::pop(RecvWork* out) {
    int oldCnt = std::atomic_fetch_sub(&cnt, 1);
    /*
    [WARNING] 

    After here, two cases should be taken care of.
    1. If "n == oldCnt", we need guard against "put" to avoid contaminating "ret" by the "putting".
    2. If "0 >= oldCnt", we need guard against another "pop" to avoid over-popping. 
    */
    if (0 >= oldCnt) {
        // "pop" could be accessed by either "GameThread/pollUdpRecvRingBuff" or "UvRecvThread/put", thus we should be proactively guarding against concurrent popping while "1 == cnt"
        ++cnt;
        return false;
    }

    // When concurrent "pop"s reach here, over-popping is definitely avoided.
    int oldSt = st.load();
    if (out) {
        RecvWork* src = (&eles[oldSt]);
        memset(out->ui8Arr, 0, sizeof out->ui8Arr);
        memcpy(out->ui8Arr, src, src->bytesLen);
        out->bytesLen = src->bytesLen;
    }
    int newSt = oldSt + 1;
    if (newSt >= n) {
        newSt -= n;
    }
    if (st.compare_exchange_weak(oldSt, newSt)) {
        return true;
    } else {
        // Failed concurrent access should recover the "cnt"
        ++cnt;
        return false;
    }
}
