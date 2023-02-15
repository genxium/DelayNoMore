package resolv

const (
	RING_BUFF_CONSECUTIVE_SET     = int32(0)
	RING_BUFF_NON_CONSECUTIVE_SET = int32(1)
	RING_BUFF_FAILED_TO_SET       = int32(2)
)

type RingBuffer struct {
	Ed        int32 // write index, open index
	St        int32 // read index, closed index
	EdFrameId int32
	StFrameId int32
	N         int32
	Cnt       int32 // the count of valid elements in the buffer, used mainly to distinguish what "st == ed" means for "Pop" and "Get" methods
	Eles      []interface{}
}

func NewRingBuffer(n int32) *RingBuffer {
	return &RingBuffer{
		Ed:        0,
		St:        0,
		EdFrameId: 0,
		StFrameId: 0,
		N:         n,
		Cnt:       0,
		Eles:      make([]interface{}, n),
	}
}

func (rb *RingBuffer) Put(pItem interface{}) {
	for 0 < rb.Cnt && rb.Cnt >= rb.N {
		// Make room for the new element
		rb.Pop()
	}
	rb.Eles[rb.Ed] = pItem
	rb.EdFrameId++
	rb.Cnt++
	rb.Ed++
	if rb.Ed >= rb.N {
		rb.Ed -= rb.N // Deliberately not using "%" operator for performance concern
	}
}

func (rb *RingBuffer) Pop() interface{} {
	if 0 == rb.Cnt {
		return nil
	}
	pItem := rb.Eles[rb.St]
	rb.StFrameId++
	rb.Cnt--
	rb.St++
	if rb.St >= rb.N {
		rb.St -= rb.N
	}
	return pItem
}

func (rb *RingBuffer) GetArrIdxByOffset(offsetFromSt int32) int32 {
	if 0 == rb.Cnt || 0 > offsetFromSt {
		return -1
	}
	arrIdx := rb.St + offsetFromSt
	if rb.St < rb.Ed {
		// case#1: 0...st...ed...N-1
		if rb.St <= arrIdx && arrIdx < rb.Ed {
			return arrIdx
		}
	} else {
		// if rb.St >= rb.Ed
		// case#2: 0...ed...st...N-1
		if arrIdx >= rb.N {
			arrIdx -= rb.N
		}
		if arrIdx >= rb.St || arrIdx < rb.Ed {
			return arrIdx
		}
	}

	return -1
}

func (rb *RingBuffer) GetByOffset(offsetFromSt int32) interface{} {
	arrIdx := rb.GetArrIdxByOffset(offsetFromSt)
	if -1 == arrIdx {
		return nil
	}
	return rb.Eles[arrIdx]
}

func (rb *RingBuffer) GetByFrameId(frameId int32) interface{} {
	if frameId >= rb.EdFrameId || frameId < rb.StFrameId {
		return nil
	}
	return rb.GetByOffset(frameId - rb.StFrameId)
}

// [WARNING] During a battle, frontend could receive non-consecutive frames (either renderFrame or inputFrame) due to resync, the buffer should handle these frames properly.
func (rb *RingBuffer) SetByFrameId(pItem interface{}, frameId int32) (int32, int32, int32) {
	oldStFrameId, oldEdFrameId := rb.StFrameId, rb.EdFrameId
	if frameId < oldStFrameId {
		return RING_BUFF_FAILED_TO_SET, oldStFrameId, oldEdFrameId
	}
	// By now "rb.StFrameId <= frameId"
	if oldEdFrameId > frameId {
		arrIdx := rb.GetArrIdxByOffset(frameId - rb.StFrameId)
		if -1 != arrIdx {
			rb.Eles[arrIdx] = pItem
			return RING_BUFF_CONSECUTIVE_SET, oldStFrameId, oldEdFrameId
		}
	}

	// By now "rb.EdFrameId <= frameId"
	ret := RING_BUFF_CONSECUTIVE_SET
	if oldEdFrameId < frameId {
		rb.St, rb.Ed = 0, 0
		rb.StFrameId, rb.EdFrameId = frameId, frameId
		rb.Cnt = 0
		ret = RING_BUFF_NON_CONSECUTIVE_SET
	}

	// By now "rb.EdFrameId == frameId"
	rb.Put(pItem)

	return ret, oldStFrameId, oldEdFrameId
}

func (rb *RingBuffer) Clear() {
	for 0 < rb.Cnt {
		rb.Pop()
	}
	rb.St = 0
	rb.Ed = 0
	rb.StFrameId = 0
	rb.EdFrameId = 0
}
