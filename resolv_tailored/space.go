package resolv

// Space represents a collision space. Internally, each Space contains a 2D array of Cells, with each Cell being the same size. Cells contain information on which
// Objects occupy those spaces.
type Space struct {
	Cells                 [][]*Cell
	CellWidth, CellHeight int // Width and Height of each Cell in "world-space" / pixels / whatever
}

// NewSpace creates a new Space. spaceWidth and spaceHeight is the width and height of the Space (usually in pixels), which is then populated with cells of size
// cellWidth by cellHeight. Generally, you want cells to be the size of the smallest collide-able objects in your game, and you want to move Objects at a maximum
// speed of one cell size per collision check to avoid missing any possible collisions.
func NewSpace(spaceWidth, spaceHeight, cellWidth, cellHeight int) *Space {

	sp := &Space{}
	sp.CellWidth = cellWidth
	sp.CellHeight = cellHeight

	sp.Resize(spaceWidth/cellWidth, spaceHeight/cellHeight)

	return sp

}

// [WARNING] The slice type boxing/unboxing is proved by profiling to be heavy after transpiled to JavaScript, thus adding some "XxxSingle" shortcuts here.
// Add adds the specified Objects to the Space, updating the Space's cells to refer to the Object.
func (sp *Space) AddSingle(obj *Object) {

	if sp == nil {
		panic("ERROR: space is nil")
	}

	obj.Space = sp

	// We call Update() once to make sure the object gets its cells added.
	obj.Update()
}

func (sp *Space) Add(objects ...*Object) {

	if sp == nil {
		panic("ERROR: space is nil")
	}

	for _, obj := range objects {

		obj.Space = sp

		// We call Update() once to make sure the object gets its cells added.
		obj.Update()

	}

}

// Remove removes the specified Objects from being associated with the Space. This should be done whenever an Object is removed from the
// game.
func (sp *Space) RemoveSingle(obj *Object) {

	if sp == nil {
		panic("ERROR: space is nil")
	}

	for 0 < obj.TouchingCells.Cnt {
		cell := obj.TouchingCells.Pop().(*Cell)
		cell.unregister(obj)
	}

	obj.Space = nil
}

func (sp *Space) Remove(objects ...*Object) {

	if sp == nil {
		panic("ERROR: space is nil")
	}

	for _, obj := range objects {
		for 0 < obj.TouchingCells.Cnt {
			cell := obj.TouchingCells.Pop().(*Cell)
			cell.unregister(obj)
		}

		obj.Space = nil

	}

}

// Objects loops through all Cells in the Space (from top to bottom, and from left to right) to return all Objects
// that exist in the Space. Of course, each Object is counted only once.
func (sp *Space) Objects() []*Object {

	objectsAdded := map[*Object]bool{}
	objects := []*Object{}
	cyUpper := len(sp.Cells)
	for cy := 0; cy < cyUpper; cy++ {
		cxUpper := len(sp.Cells[cy])
		for cx := 0; cx < cxUpper; cx++ {
			rb := sp.Cells[cy][cx].Objects
			for i := rb.StFrameId; i < rb.EdFrameId; i++ {
				o := rb.GetByFrameId(i).(*Object)
				if _, added := objectsAdded[o]; !added {
					objects = append(objects, o)
					objectsAdded[o] = true
				}
			}
		}

	}

	return objects

}

// Resize resizes the internal Cells array.
func (sp *Space) Resize(width, height int) {
	sp.Cells = make([][]*Cell, height)
	for y := 0; y < height; y++ {
		sp.Cells[y] = make([]*Cell, width)
		for x := 0; x < width; x++ {
			sp.Cells[y][x] = newCell(x, y)
		}
	}
}

func (sp *Space) GetCell(x, y int) *Cell {

	if y >= 0 && y < len(sp.Cells) && x >= 0 && x < len(sp.Cells[y]) {
		return sp.Cells[y][x]
	}
	return nil

}

// CheckCells checks a set of cells (from x,y to x + w, y + h in cellular coordinates) and return the first object within those Cells that contains any of the tags given.
// If no tags are given, then CheckCells will return the first Object found in any Cell.
func (sp *Space) CheckCells(x, y, w, h int, tags ...string) *Object {

	for ix := x; ix < x+w; ix++ {

		for iy := y; iy < y+h; iy++ {

			cell := sp.GetCell(ix, iy)

			if cell != nil {
				rb := cell.Objects
				if len(tags) > 0 {
					if cell.ContainsTags(tags...) {
						for i := rb.StFrameId; i < rb.EdFrameId; i++ {
							obj := rb.GetByFrameId(i).(*Object)
							if obj.HasTags(tags...) {
								return obj
							}
						}
					}
				} else if cell.Occupied() {
					return rb.GetByFrameId(rb.StFrameId).(*Object)
				}

			}

		}
	}

	return nil

}

// CheckCellsWorld checks the cells of the Grid with the given world coordinates.
// Internally, this is just syntactic sugar for calling Space.WorldToSpace() on the
// position and size given.
func (sp *Space) CheckCellsWorld(x, y, w, h float64, tags ...string) *Object {

	sx, sy := sp.WorldToSpace(x, y)
	cw, ch := sp.WorldToSpace(w, h)

	return sp.CheckCells(sx, sy, cw, ch, tags...)

}

// UnregisterAllObjects unregisters all Objects registered to Cells in the Space.
func (sp *Space) UnregisterAllObjects() {

	for y := 0; y < len(sp.Cells); y++ {
		for x := 0; x < len(sp.Cells[y]); x++ {
			cell := sp.Cells[y][x]
			rb := cell.Objects
			for i := rb.StFrameId; i < rb.EdFrameId; i++ {
				o := rb.GetByFrameId(i).(*Object)
				sp.RemoveSingle(o)
			}
		}

	}

}

// WorldToSpace converts from a world position (x, y) to a position in the Space (a grid-based position).
func (sp *Space) WorldToSpace(x, y float64) (int, int) {
	// [WARNING] DON'T use "int(...)" syntax to convert float to int, it's not supported by go2cs!
	var fx int = (int)(Floor(x / float64(sp.CellWidth)))
	var fy int = (int)(Floor(y / float64(sp.CellHeight)))
	return fx, fy
}

// SpaceToWorld converts from a position in the Space (on a grid) to a world-based position, given the size of the Space when first created.
func (sp *Space) SpaceToWorld(x, y int) (float64, float64) {
	fx := float64(x * sp.CellWidth)
	fy := float64(y * sp.CellHeight)
	return fx, fy
}

// Height returns the height of the Space grid in Cells (so a 320x240 Space with 16x16 cells would have a height of 15).
func (sp *Space) Height() int {
	return len(sp.Cells)
}

// Width returns the width of the Space grid in Cells (so a 320x240 Space with 16x16 cells would have a width of 20).
func (sp *Space) Width() int {
	if len(sp.Cells) > 0 {
		return len(sp.Cells[0])
	}
	return 0
}

func (sp *Space) CellsInLine(startX, startY, endX, endY int) []*Cell {

	cells := []*Cell{}
	cell := sp.GetCell(startX, startY)
	endCell := sp.GetCell(endX, endY)

	if cell != nil && endCell != nil {

		dv := Vector{float64(endX - startX), float64(endY - startY)}.Unit()
		dv[0] *= float64(sp.CellWidth / 2)
		dv[1] *= float64(sp.CellHeight / 2)

		pX, pY := sp.SpaceToWorld(startX, startY)
		p := Vector{pX + float64(sp.CellWidth/2), pY + float64(sp.CellHeight/2)}

		alternate := false

		for cell != nil {

			if cell == endCell {
				cells = append(cells, cell)
				break
			}

			cells = append(cells, cell)

			if alternate {
				p[1] += dv[1]
			} else {
				p[0] += dv[0]
			}

			cx, cy := sp.WorldToSpace(p[0], p[1])
			c := sp.GetCell(cx, cy)
			if c != cell {
				cell = c
			}
			alternate = !alternate

		}

	}

	return cells

}
