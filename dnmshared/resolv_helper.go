package dnmshared

import (
	"github.com/kvartborg/vector"
	"github.com/solarlune/resolv"
    "math"
)

func GenerateRectCollider(origX, origY, w, h, spaceOffsetX, spaceOffsetY float64, tag string) *resolv.Object {
    collider := resolv.NewObject(origX-w*0.5+spaceOffsetX, origY-h*0.5+spaceOffsetY, w, h, tag)
    shape := resolv.NewRectangle(0, 0, w, h)  
    collider.SetShape(shape)
    return collider
}

func GenerateConvexPolygonCollider(unalignedSrc *Polygon2D, spaceOffsetX, spaceOffsetY float64, tag string) *resolv.Object {
    aligned := AlignPolygon2DToBoundingBox(unalignedSrc)
    var w, h float64 = 0, 0

    shape := resolv.NewConvexPolygon()
    for i, pi := range aligned.Points {
        for j, pj := range aligned.Points {
            if i == j {
                continue
            }
            if math.Abs(pj.X-pi.X) > w {
                w = math.Abs(pj.X - pi.X)
            }
            if math.Abs(pj.Y-pi.Y) > h {
                h = math.Abs(pj.Y - pi.Y)
            }
        }
    }

    for i := 0; i < len(aligned.Points); i++ {
        p := aligned.Points[i]
        shape.AddPoints(p.X, p.Y)
    }

    collider := resolv.NewObject(aligned.Anchor.X+spaceOffsetX, aligned.Anchor.Y+spaceOffsetY, w, h, tag)
    collider.SetShape(shape)

    return collider
}

func CalculateMTVForConvexPolygon(cp *resolv.ConvexPolygon, other *resolv.ConvexPolygon) vector.Vector {
	delta := vector.Vector{0, 0}

	smallest := vector.Vector{math.MaxFloat64, 0}

    for _, axis := range cp.SATAxes() {
        if !cp.Project(axis).Overlapping(other.Project(axis)) {
            return nil
        }

        overlap := cp.Project(axis).Overlap(other.Project(axis))

        if smallest.Magnitude() > overlap {
            smallest = axis.Scale(overlap)
        }

    }

    for _, axis := range other.SATAxes() {

        if !cp.Project(axis).Overlapping(other.Project(axis)) {
            return nil
        }

        overlap := cp.Project(axis).Overlap(other.Project(axis))

        if smallest.Magnitude() > overlap {
            smallest = axis.Scale(overlap)
        }

    }

	delta[0] = smallest[0]
	delta[1] = smallest[1]

	return delta
}
