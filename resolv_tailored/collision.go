package resolv

// Collision contains the results of an Object.Check() call, and represents a collision between an Object and cells that contain other Objects.
// The Objects array indicate the Objects collided with.
type Collision struct {
	checkingObject *Object     // The checking object
	dx, dy         float64     // The delta the checking object was moving on that caused this collision
	Objects        *RingBuffer // Slice of objects that were collided with; sorted according to distance to calling Object.
	Cells          *RingBuffer // Slice of cells that were collided with; sorted according to distance to calling Object.
}

func NewCollision() *Collision {
	c := &Collision{}
	c.Objects = NewRingBuffer(16) // I don't expect it to exceed 10 actually
	c.Cells = NewRingBuffer(16)
	return c
}

func (cc *Collision) Clear() {
	cc.checkingObject = nil
	cc.dx = 0
	cc.dy = 0
	cc.Objects.Clear()
	cc.Cells.Clear()
}

func (cc *Collision) PopFirstCollidedObject() *Object {
	if 0 >= cc.Objects.Cnt {
		return nil
	}
	return cc.Objects.Pop().(*Object)
}

// HasTags returns whether any objects within the Collision have all of the specified tags. This slice does not contain the Object that called Check().
func (cc *Collision) HasTags(tags ...string) bool {
	rb := cc.Objects
	for i := rb.StFrameId; i < rb.EdFrameId; i++ {
		o := rb.GetByFrameId(i).(*Object)
		if o == cc.checkingObject {
			continue
		}
		if o.HasTags(tags...) {
			return true
		}

	}

	return false
}

// ObjectsByTags returns a slice of Objects from the cells reported by a Collision object by searching for Objects with a specific set of tags.
// This slice does not contain the Object that called Check().
func (cc *Collision) ObjectsByTags(tags ...string) []*Object {

	objs := []*Object{}

	rb := cc.Objects
	for i := rb.StFrameId; i < rb.EdFrameId; i++ {
		o := rb.GetByFrameId(i).(*Object)
		if o == cc.checkingObject {
			continue
		}
		if o.HasTags(tags...) {
			objs = append(objs, o)
		}

	}

	return objs

}

// ContactWithObject returns the delta to move to come into contact with the specified Object.
func (cc *Collision) ContactWithObject(obj *Object) Vector {

	delta := Vector{0, 0}

	if cc.dx < 0 {
		delta[0] = obj.X + obj.W - cc.checkingObject.X
	} else if cc.dx > 0 {
		delta[0] = obj.X - cc.checkingObject.W - cc.checkingObject.X
	}

	if cc.dy < 0 {
		delta[1] = obj.Y + obj.H - cc.checkingObject.Y
	} else if cc.dy > 0 {
		delta[1] = obj.Y - cc.checkingObject.H - cc.checkingObject.Y
	}

	return delta

}

// ContactWithCell returns the delta to move to come into contact with the specified Cell.
func (cc *Collision) ContactWithCell(cell *Cell) Vector {

	delta := Vector{0, 0}

	cx := float64(cell.X * cc.checkingObject.Space.CellWidth)
	cy := float64(cell.Y * cc.checkingObject.Space.CellHeight)

	if cc.dx < 0 {
		delta[0] = cx + float64(cc.checkingObject.Space.CellWidth) - cc.checkingObject.X
	} else if cc.dx > 0 {
		delta[0] = cx - cc.checkingObject.W - cc.checkingObject.X
	}

	if cc.dy < 0 {
		delta[1] = cy + float64(cc.checkingObject.Space.CellHeight) - cc.checkingObject.Y
	} else if cc.dy > 0 {
		delta[1] = cy - cc.checkingObject.H - cc.checkingObject.Y
	}

	return delta

}

// SlideAgainstCell returns how much distance the calling Object can slide to avoid a collision with the targetObject. This only works on vertical and horizontal axes (x and y directly),
// primarily for platformers / top-down games. avoidTags is a sequence of tags (as strings) to indicate when sliding is valid (i.e. if a Cell contains an Object that has the tag given in
// the avoidTags slice, then sliding CANNOT happen). If sliding is not able to be done for whatever reason, SlideAgainstCell returns nil.
func (cc *Collision) SlideAgainstCell(cell *Cell, avoidTags ...string) Vector {

	sp := cc.checkingObject.Space

	collidingCell := cc.Cells.GetByFrameId(cc.Cells.StFrameId).(*Cell)
	ccX, ccY := sp.SpaceToWorld(collidingCell.X, collidingCell.Y)
	hX := float64(sp.CellWidth) / 2.0
	hY := float64(sp.CellHeight) / 2.0

	ccX += hX
	ccY += hY

	oX, oY := cc.checkingObject.Center()

	diffX := oX - ccX
	diffY := oY - ccY

	left := sp.Cell(collidingCell.X-1, collidingCell.Y)
	right := sp.Cell(collidingCell.X+1, collidingCell.Y)
	up := sp.Cell(collidingCell.X, collidingCell.Y-1)
	down := sp.Cell(collidingCell.X, collidingCell.Y+1)

	slide := Vector{0, 0}

	// Moving vertically
	if cc.dy != 0 {

		if diffX > 0 && (right == nil || !right.ContainsTags(avoidTags...)) {
			// Slide right
			slide[0] = ccX + hX - cc.checkingObject.X
		} else if diffX < 0 && (left == nil || !left.ContainsTags(avoidTags...)) {
			// Slide left
			slide[0] = ccX - hX - (cc.checkingObject.X + cc.checkingObject.W)
		} else {
			return nil
		}
	}

	if cc.dx != 0 {
		if diffY > 0 && (down == nil || !down.ContainsTags(avoidTags...)) {
			// Slide down
			slide[1] = ccY + hY - cc.checkingObject.Y
		} else if diffY < 0 && (up == nil || !up.ContainsTags(avoidTags...)) {
			// Slide up
			slide[1] = ccY - hY - (cc.checkingObject.Y + cc.checkingObject.H)
		} else {
			return nil
		}
	}

	return slide

}
