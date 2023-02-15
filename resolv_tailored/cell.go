package resolv

// Cell is used to contain and organize Object information.
type Cell struct {
	X, Y    int         // The X and Y position of the cell in the Space - note that this is in Grid position, not World position.
	Objects *RingBuffer // The Objects that a Cell contains.
}

// newCell creates a new cell at the specified X and Y position. Should not be used directly.
func newCell(x, y int) *Cell {
	return &Cell{
		X:       x,
		Y:       y,
		Objects: NewRingBuffer(16), // A single cell is so small thus wouldn't have many touching objects simultaneously
	}
}

// register registers an object with a Cell. Should not be used directly.
func (cell *Cell) register(obj *Object) {
	if !cell.Contains(obj) {
		cell.Objects.Put(obj)
	}
}

// unregister unregisters an object from a Cell. Should not be used directly.
func (cell *Cell) unregister(obj *Object) {
	rb := cell.Objects
	for i := rb.StFrameId; i < rb.EdFrameId; i++ {
		o := rb.GetByFrameId(i).(*Object)
		if o == obj {
			// swap with the st element
			rb.SetByFrameId(rb.GetByFrameId(rb.StFrameId), i)
			// pop the current st element
			rb.Pop()
			break
		}

	}

}

// Contains returns whether a Cell contains the specified Object at its position.
func (cell *Cell) Contains(obj *Object) bool {
	rb := cell.Objects
	for i := rb.StFrameId; i < rb.EdFrameId; i++ {
		o := rb.GetByFrameId(i).(*Object)
		if o == obj {
			return true
		}
	}
	return false
}

// ContainsTags returns whether a Cell contains an Object that has the specified tag at its position.
func (cell *Cell) ContainsTags(tags ...string) bool {
	rb := cell.Objects
	for i := rb.StFrameId; i < rb.EdFrameId; i++ {
		o := rb.GetByFrameId(i).(*Object)
		if o.HasTags(tags...) {
			return true
		}
	}
	return false
}

// Occupied returns whether a Cell contains any Objects at all.
func (cell *Cell) Occupied() bool {
	return 0 < cell.Objects.Cnt
}
