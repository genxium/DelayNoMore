package dnmshared

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
		Ed:   0,
		St:   0,
		N:    n,
		Cnt:  0,
		Eles: make([]interface{}, n),
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

func (rb *RingBuffer) GetByOffset(offsetFromSt int32) interface{} {
	if 0 == rb.Cnt {
		return nil
	}
	arrIdx := rb.St + offsetFromSt
	if rb.St < rb.Ed {
		// case#1: 0...st...ed...N-1
		if rb.St <= arrIdx && arrIdx < rb.Ed {
			return rb.Eles[arrIdx]
		}
	} else {
		// if rb.St >= rb.Ed
		// case#2: 0...ed...st...N-1
		if arrIdx >= rb.N {
			arrIdx -= rb.N
		}
		if arrIdx >= rb.St || arrIdx < rb.Ed {
			return rb.Eles[arrIdx]
		}
	}

	return nil
}

func (rb *RingBuffer) GetByFrameId(frameId int32) interface{} {
	if frameId >= rb.EdFrameId || frameId < rb.StFrameId {
		return nil
	}
	return rb.GetByOffset(frameId - rb.StFrameId)
}
