package battle

import (
	"resolv"
)

/*
[WARNING] NOT USED ANYWHERE YET!!!
*/
type InplaceRingBuffer struct {
	Ed        int32 // write index, open index
	St        int32 // read index, closed index
	EdFrameId int32
	StFrameId int32
	N         int32
	Cnt       int32 // the count of valid elements in the buffer, used mainly to distinguish what "st == ed" means for "Pop" and "Get" methods
	Eles      []interface{}
}

func NewInplaceRingBuffer(n int32) *InplaceRingBuffer {
	return &InplaceRingBuffer{
		Ed:        0,
		St:        0,
		EdFrameId: 0,
		StFrameId: 0,
		N:         n,
		Cnt:       0,
		Eles:      make([]interface{}, n),
	}
}

func (rb *InplaceRingBuffer) Put(pItem interface{}) {
	switch pItem.(type) {
	case *RoomDownsyncFrame:
	default:
		// Other types are not supported!
		return
	}
	for 0 < rb.Cnt && rb.Cnt >= rb.N {
		// Make room for the new element
		rb.Pop(nil)
	}
	switch v := pItem.(type) {
	case *RoomDownsyncFrame:
		CloneRoomDownsyncFrame(v.Id, v.PlayersArr, v.BulletLocalIdCounter, v.MeleeBullets, v.FireballBullets, rb.Eles[rb.Ed].(*RoomDownsyncFrame))
	}
	rb.EdFrameId++
	rb.Cnt++
	rb.Ed++
	if rb.Ed >= rb.N {
		rb.Ed -= rb.N // Deliberately not using "%" operator for performance concern
	}
}

func (rb *InplaceRingBuffer) Pop(holder interface{}) bool {
	switch holder.(type) {
	case *RoomDownsyncFrame, nil:
	default:
		// Other types are not supported!
		return false
	}
	if 0 == rb.Cnt {
		return false
	}
	switch u := holder.(type) {
	case *RoomDownsyncFrame:
		v := rb.Eles[rb.St].(*RoomDownsyncFrame)
		CloneRoomDownsyncFrame(v.Id, v.PlayersArr, v.BulletLocalIdCounter, v.MeleeBullets, v.FireballBullets, u)
		// If nil, there's no holder for output, I'm OK for that...
	}
	rb.StFrameId++
	rb.Cnt--
	rb.St++
	if rb.St >= rb.N {
		rb.St -= rb.N
	}
	return true
}

func (rb *InplaceRingBuffer) GetArrIdxByOffset(offsetFromSt int32) int32 {
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

func (rb *InplaceRingBuffer) GetByOffset(offsetFromSt int32, holder interface{}) bool {
	switch holder.(type) {
	case *RoomDownsyncFrame:
	default:
		// Other types are not supported!
		return false
	}
	arrIdx := rb.GetArrIdxByOffset(offsetFromSt)
	if -1 == arrIdx {
		return false
	}
	switch u := holder.(type) {
	case *RoomDownsyncFrame:
		v := rb.Eles[arrIdx].(*RoomDownsyncFrame)
		CloneRoomDownsyncFrame(v.Id, v.PlayersArr, v.BulletLocalIdCounter, v.MeleeBullets, v.FireballBullets, u)
	}
	return true
}

func (rb *InplaceRingBuffer) GetByFrameId(frameId int32, holder interface{}) bool {
	switch holder.(type) {
	case *RoomDownsyncFrame:
	default:
		// Other types are not supported!
		return false
	}
	if frameId >= rb.EdFrameId || frameId < rb.StFrameId {
		return false
	}
	return rb.GetByOffset(frameId-rb.StFrameId, holder)
}

// [WARNING] During a battle, frontend could receive non-consecutive frames (either renderFrame or inputFrame) due to resync, the buffer should handle these frames properly.
func (rb *InplaceRingBuffer) SetByFrameId(pItem interface{}, frameId int32) (int32, int32, int32) {
	oldStFrameId, oldEdFrameId := rb.StFrameId, rb.EdFrameId
	switch pItem.(type) {
	case *RoomDownsyncFrame:
	default:
		// Other types are not supported!
		return resolv.RING_BUFF_FAILED_TO_SET, oldStFrameId, oldEdFrameId
	}
	if frameId < oldStFrameId {
		return resolv.RING_BUFF_FAILED_TO_SET, oldStFrameId, oldEdFrameId
	}
	// By now "rb.StFrameId <= frameId"
	if oldEdFrameId > frameId {
		arrIdx := rb.GetArrIdxByOffset(frameId - rb.StFrameId)
		if -1 != arrIdx {
			switch v := pItem.(type) {
			case *RoomDownsyncFrame:
				CloneRoomDownsyncFrame(v.Id, v.PlayersArr, v.BulletLocalIdCounter, v.MeleeBullets, v.FireballBullets, rb.Eles[arrIdx].(*RoomDownsyncFrame))
				return resolv.RING_BUFF_CONSECUTIVE_SET, oldStFrameId, oldEdFrameId
			default:
				// Other types are not supported!
				return resolv.RING_BUFF_FAILED_TO_SET, oldStFrameId, oldEdFrameId
			}
		}
	}

	// By now "rb.EdFrameId <= frameId"
	ret := resolv.RING_BUFF_CONSECUTIVE_SET
	if oldEdFrameId < frameId {
		rb.St, rb.Ed = 0, 0
		rb.StFrameId, rb.EdFrameId = frameId, frameId
		rb.Cnt = 0
		ret = resolv.RING_BUFF_NON_CONSECUTIVE_SET
	}

	// By now "rb.EdFrameId == frameId"
	rb.Put(pItem)

	return ret, oldStFrameId, oldEdFrameId
}

func (rb *InplaceRingBuffer) Clear() {
	for 0 < rb.Cnt {
		rb.Pop(nil)
	}
	rb.St = 0
	rb.Ed = 0
	rb.StFrameId = 0
	rb.EdFrameId = 0
}

func (rb *InplaceRingBuffer) GetStFrameId() int32 {
	return rb.StFrameId
}

func (rb *InplaceRingBuffer) GetEdFrameId() int32 {
	return rb.EdFrameId
}

func (rb *InplaceRingBuffer) GetCnt() int32 {
	return rb.Cnt
}
