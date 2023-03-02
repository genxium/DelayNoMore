package resolv

type Shape interface {
	// Intersection tests to see if a Shape intersects with the other given Shape. dx and dy are delta movement variables indicating
	// movement to be applied before the intersection check (thereby allowing you to see if a Shape would collide with another if it
	// were in a different relative location). If an Intersection is found, a ContactSet will be returned, giving information regarding
	// the intersection.
	Intersection(dx, dy float64, other Shape) *ContactSet
	// Bounds returns the top-left and bottom-right points of the Shape.
	Bounds() (Vector, Vector)
	// Position returns the X and Y position of the Shape.
	Position() (float64, float64)
	// SetPosition allows you to place a Shape at another location.
	SetPosition(x, y float64)
	// Clone duplicates the Shape.
	Clone() Shape
}

// A Line is a helper shape used to determine if two ConvexPolygon lines intersect; you can't create a Line to use as a Shape.
// Instead, you can create a ConvexPolygon, specify two points, and set its Closed value to false.
type Line struct {
	Start, End Vector
}

func NewLine(x, y, x2, y2 float64) *Line {
	l := &Line{}
	l.Start = Vector{x, y}
	l.End = Vector{x2, y2}
	return l
}

func (line *Line) Normal() Vector {
	dy := line.End[1] - line.Start[1]
	dx := line.End[0] - line.Start[0]
	return Vector{dy, -dx}.Unit()
}

// IntersectionPointsLine returns the intersection point of a Line with another Line as a Vector. If no intersection is found, it will return nil.
func (line *Line) IntersectionPointsLine(other *Line) Vector {

	det := (line.End[0]-line.Start[0])*(other.End[1]-other.Start[1]) - (other.End[0]-other.Start[0])*(line.End[1]-line.Start[1])

	if det != 0 {

		// MAGIC MATH; the extra + 1 here makes it so that corner cases (literally, lines going through corners) works.

		// lambda := (float32(((line.Y-b.Y)*(b.X2-b.X))-((line.X-b.X)*(b.Y2-b.Y))) + 1) / float32(det)
		lambda := (((line.Start[1] - other.Start[1]) * (other.End[0] - other.Start[0])) - ((line.Start[0] - other.Start[0]) * (other.End[1] - other.Start[1])) + 1) / det

		// gamma := (float32(((line.Y-b.Y)*(line.X2-line.X))-((line.X-b.X)*(line.Y2-line.Y))) + 1) / float32(det)
		gamma := (((line.Start[1] - other.Start[1]) * (line.End[0] - line.Start[0])) - ((line.Start[0] - other.Start[0]) * (line.End[1] - line.Start[1])) + 1) / det

		if (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1) {

			// Delta
			dx := line.End[0] - line.Start[0]
			dy := line.End[1] - line.Start[1]

			// dx, dy := line.GetDelta()

			return Vector{line.Start[0] + (lambda * dx), line.Start[1] + (lambda * dy)}
		}

	}

	return nil

}

type ConvexPolygon struct {
	Points *RingBuffer
	X, Y   float64
	Closed bool
}

// NewConvexPolygon creates a new convex polygon from the provided set of X and Y positions of 2D points (or vertices). Should generally be ordered clockwise,
// from X and Y of the first, to X and Y of the last. For example: NewConvexPolygon(0, 0, 10, 0, 10, 10, 0, 10) would create a 10x10 convex
// polygon square, with the vertices at {0,0}, {10,0}, {10, 10}, and {0, 10}.
func NewConvexPolygon(points ...float64) *ConvexPolygon {

	cp := &ConvexPolygon{}
	cp.Points = NewRingBuffer(6) // I don't expected more points to be coped with in this particular game
	cp.Closed = true

	cp.AddPoints(points...)

	return cp
}

func (cp *ConvexPolygon) GetPointByOffset(offset int32) Vector {
	if cp.Points.Cnt <= offset {
		return nil
	}
	return cp.Points.GetByFrameId(cp.Points.StFrameId + offset).(Vector)
}

func (cp *ConvexPolygon) Clone() Shape {

	newPoly := NewConvexPolygon()
	newPoly.X = cp.X
	newPoly.Y = cp.Y
	for i := int32(0); i < cp.Points.Cnt; i++ {
		newPoly.Points.Put(cp.GetPointByOffset(i))
	}
	newPoly.Closed = cp.Closed
	return newPoly
}

// AddPoints allows you to add points to the ConvexPolygon with a slice or selection of float64s, with each pair indicating an X or Y value for
// a point / vertex (i.e. AddPoints(0, 1, 2, 3) would add two points - one at {0, 1}, and another at {2, 3}).
func (cp *ConvexPolygon) AddPoints(vertexPositions ...float64) {
	for v := 0; v < len(vertexPositions); v += 2 {
		// "resolv.Vector" is an alias of "[]float64", thus already a pointer type
		cp.Points.Put(Vector{vertexPositions[v], vertexPositions[v+1]})
	}
}

func (cp *ConvexPolygon) UpdateAsRectangle(x, y, w, h float64) bool {
	// This function might look ugly but it's a fast in-place update!
	if 4 != cp.Points.Cnt {
		panic("ConvexPolygon not having exactly 4 vertices to form a rectangle#1!")
	}
	for i := int32(0); i < cp.Points.Cnt; i++ {
		thatVec := cp.GetPointByOffset(i)
		if nil == thatVec {
			panic("ConvexPolygon not having exactly 4 vertices to form a rectangle#2!")
		}
		switch i {
		case 0:
			thatVec[0] = x
			thatVec[1] = y
		case 1:
			thatVec[0] = x + w
			thatVec[1] = y
		case 2:
			thatVec[0] = x + w
			thatVec[1] = y + h
		case 3:
			thatVec[0] = x
			thatVec[1] = y + h
		}
	}
	return true
}

// Lines returns a slice of transformed Lines composing the ConvexPolygon.
func (cp *ConvexPolygon) Lines() []*Line {

	vertices := cp.Transformed()
	linesCnt := len(vertices)
	if !cp.Closed {
		linesCnt -= 1
	}
	lines := make([]*Line, linesCnt)

	for i := 0; i < linesCnt; i++ {
		start, end := vertices[i], vertices[0]
		if i < len(vertices)-1 {
			end = vertices[i+1]
		}
		line := NewLine(start[0], start[1], end[0], end[1])
		lines[i] = line
	}

	return lines

}

// Transformed returns the ConvexPolygon's points / vertices, transformed according to the ConvexPolygon's position.
func (cp *ConvexPolygon) Transformed() []Vector {
	transformed := make([]Vector, cp.Points.Cnt)
	for i := int32(0); i < cp.Points.Cnt; i++ {
		point := cp.GetPointByOffset(i)
		transformed[i] = Vector{point[0] + cp.X, point[1] + cp.Y}
	}
	return transformed
}

// Bounds returns two Vectors, comprising the top-left and bottom-right positions of the bounds of the
// ConvexPolygon, post-transformation.
func (cp *ConvexPolygon) Bounds() (Vector, Vector) {

	transformed := cp.Transformed()

	topLeft := Vector{transformed[0][0], transformed[0][1]}
	bottomRight := Vector{transformed[0][0], transformed[0][1]}

	for i := 0; i < len(transformed); i++ {

		point := transformed[i]

		if point[0] < topLeft[0] {
			topLeft[0] = point[0]
		} else if point[0] > bottomRight[0] {
			bottomRight[0] = point[0]
		}

		if point[1] < topLeft[1] {
			topLeft[1] = point[1]
		} else if point[1] > bottomRight[1] {
			bottomRight[1] = point[1]
		}

	}
	return topLeft, bottomRight
}

// Position returns the position of the ConvexPolygon.
func (cp *ConvexPolygon) Position() (float64, float64) {
	return cp.X, cp.Y
}

// SetPosition sets the position of the ConvexPolygon. The offset of the vertices compared to the X and Y position is relative to however
// you initially defined the polygon and added the vertices.
func (cp *ConvexPolygon) SetPosition(x, y float64) {
	cp.X = x
	cp.Y = y
}

// SetPositionVec allows you to set the position of the ConvexPolygon using a Vector. The offset of the vertices compared to the X and Y
// position is relative to however you initially defined the polygon and added the vertices.
func (cp *ConvexPolygon) SetPositionVec(vec Vector) {
	cp.X = vec.GetX()
	cp.Y = vec.GetY()
}

// Move translates the ConvexPolygon by the designated X and Y values.
func (cp *ConvexPolygon) Move(x, y float64) {
	cp.X += x
	cp.Y += y
}

// MoveVec translates the ConvexPolygon by the designated Vector.
func (cp *ConvexPolygon) MoveVec(vec Vector) {
	cp.X += vec.GetX()
	cp.Y += vec.GetY()
}

// SATAxes returns the axes of the ConvexPolygon for SAT intersection testing.
func (cp *ConvexPolygon) SATAxes() []Vector {
	lines := cp.Lines()
	axes := make([]Vector, len(lines))
	for i, line := range lines {
		axes[i] = line.Normal()
	}
	return axes

}

// PointInside returns if a Point (a Vector) is inside the ConvexPolygon.
func (polygon *ConvexPolygon) PointInside(point Vector) bool {

	pointLine := NewLine(point[0], point[1], point[0]+999999999999, point[1])

	contactCount := 0

	for _, line := range polygon.Lines() {

		if line.IntersectionPointsLine(pointLine) != nil {
			contactCount++
		}

	}

	return contactCount == 1
}

type ContactSet struct {
	Points []Vector // Slice of Points indicating contact between the two Shapes.
	MTV    Vector   // Minimum Translation Vector; this is the vector to move a Shape on to move it outside of its contacting Shape.
	Center Vector   // Center of the Contact set; this is the average of all Points contained within the Contact Set.
}

func NewContactSet() *ContactSet {
	cs := &ContactSet{}
	cs.Points = []Vector{}
	cs.MTV = Vector{0, 0}
	cs.Center = Vector{}
	return cs
}

// LeftmostPoint returns the left-most point out of the ContactSet's Points slice. If the Points slice is empty somehow, this returns nil.
func (cs *ContactSet) LeftmostPoint() Vector {

	var left Vector

	for _, point := range cs.Points {

		if left == nil || point[0] < left[0] {
			left = point
		}

	}

	return left

}

// RightmostPoint returns the right-most point out of the ContactSet's Points slice. If the Points slice is empty somehow, this returns nil.
func (cs *ContactSet) RightmostPoint() Vector {

	var right Vector

	for _, point := range cs.Points {

		if right == nil || point[0] > right[0] {
			right = point
		}

	}

	return right

}

// TopmostPoint returns the top-most point out of the ContactSet's Points slice. If the Points slice is empty somehow, this returns nil.
func (cs *ContactSet) TopmostPoint() Vector {

	var top Vector

	for _, point := range cs.Points {

		if top == nil || point[1] < top[1] {
			top = point
		}

	}

	return top

}

// BottommostPoint returns the bottom-most point out of the ContactSet's Points slice. If the Points slice is empty somehow, this returns nil.
func (cs *ContactSet) BottommostPoint() Vector {

	var bottom Vector

	for _, point := range cs.Points {

		if bottom == nil || point[1] > bottom[1] {
			bottom = point
		}

	}

	return bottom

}

// Intersection tests to see if a ConvexPolygon intersects with the other given Shape. dx and dy are delta movement variables indicating
// movement to be applied before the intersection check (thereby allowing you to see if a Shape would collide with another if it
// were in a different relative location). If an Intersection is found, a ContactSet will be returned, giving information regarding
// the intersection.
func (cp *ConvexPolygon) Intersection(dx, dy float64, other Shape) *ContactSet {

	contactSet := NewContactSet()

	ogX := cp.X
	ogY := cp.Y
	cp.X += dx
	cp.Y += dy

	if poly, isPoly := other.(*ConvexPolygon); isPoly {

		for _, line := range cp.Lines() {

			for _, otherLine := range poly.Lines() {

				if point := line.IntersectionPointsLine(otherLine); point != nil {
					contactSet.Points = append(contactSet.Points, point)
				}

			}

		}

	}

	if len(contactSet.Points) > 0 {
		// Do nothing
	} else {
		contactSet = nil
	}

	cp.X = ogX
	cp.Y = ogY

	return contactSet

}

// NewRectangle returns a rectangular ConvexPolygon with the vertices in clockwise order. In actuality, an AABBRectangle should be its own
// "thing" with its own optimized Intersection code check.
func NewRectangle(x, y, w, h float64) *ConvexPolygon {
	return NewConvexPolygon(
		x, y,
		x+w, y,
		x+w, y+h,
		x, y+h,
	)
}
