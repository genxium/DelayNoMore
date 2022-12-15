package dnmshared

import (
	. "dnmshared/sharedprotos"
	"math"
)

func NormVec2D(dx, dy float64) Vec2D {
	return Vec2D{X: dy, Y: -dx}
}

func AlignPolygon2DToBoundingBox(input *Polygon2D) *Polygon2D {
	// Transform again to put "anchor" at the "bottom-left point (w.r.t. world space)" of the bounding box for "resolv"
	boundingBoxBL := &Vec2D{
		X: math.MaxFloat64,
		Y: math.MaxFloat64,
	}
	for _, p := range input.Points {
		if p.X < boundingBoxBL.X {
			boundingBoxBL.X = p.X
		}
		if p.Y < boundingBoxBL.Y {
			boundingBoxBL.Y = p.Y
		}
	}

	// Now "input.Anchor" should move to "input.Anchor+boundingBoxBL", thus "boundingBoxBL" is also the value of the negative diff for all "input.Points"
	output := &Polygon2D{
		Anchor: &Vec2D{
			X: input.Anchor.X + boundingBoxBL.X,
			Y: input.Anchor.Y + boundingBoxBL.Y,
		},
		Points: make([]*Vec2D, len(input.Points)),
	}

	for i, p := range input.Points {
		output.Points[i] = &Vec2D{
			X: p.X - boundingBoxBL.X,
			Y: p.Y - boundingBoxBL.Y,
		}
	}

	return output
}

func Distance(pt1 *Vec2D, pt2 *Vec2D) float64 {
	dx := pt1.X - pt2.X
	dy := pt1.Y - pt2.Y
	return math.Sqrt(dx*dx + dy*dy)
}
