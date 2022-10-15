package dnmshared

import (
	"math"
)

// Use type `float64` for json unmarshalling of numbers.
type Direction struct {
	Dx int32 `json:"dx,omitempty"`
	Dy int32 `json:"dy,omitempty"`
}

type Vec2D struct {
	X float64 `json:"x,omitempty"`
	Y float64 `json:"y,omitempty"`
}

type Polygon2D struct {
	Anchor *Vec2D   `json:"-"` // This "Polygon2D.Anchor" is used to be assigned to "B2BodyDef.Position", which in turn is used as the position of the FIRST POINT of the polygon.
	Points []*Vec2D `json:"-"`

	/*
	   When used to represent a "polyline directly drawn in a `Tmx file`", we can initialize both "Anchor" and "Points" simultaneously.

	   Yet when used to represent a "polyline drawn in a `Tsx file`", we have to first initialize "Points w.r.t. center of the tile-rectangle", and then "Anchor(initially nil) of the tile positioned in the `Tmx file`".

	   Refer to https://shimo.im/docs/SmLJJhXm2C8XMzZT for more information.
	*/

	/*
	  [WARNING] Used to cache "`TileWidth & TileHeight` of a Tsx file" only.
	*/
	TileWidth  int
	TileHeight int

	/*
	  [WARNING] Used to cache "`Width & TileHeight` of an object in Tmx file" only.
	*/
	TmxObjectWidth  float64
	TmxObjectHeight float64
}

func Distance(pt1 *Vec2D, pt2 *Vec2D) float64 {
	dx := pt1.X - pt2.X
	dy := pt1.Y - pt2.Y
	return math.Sqrt(dx*dx + dy*dy)
}
