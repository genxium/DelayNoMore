package dnmshared

import (
	"fmt"
	"github.com/kvartborg/vector"
	"github.com/solarlune/resolv"
	"math"
	"strings"
	. "dnmshared/protos"
)

func ConvexPolygonStr(body *resolv.ConvexPolygon) string {
	var s []string = make([]string, len(body.Points))
	for i, p := range body.Points {
		s[i] = fmt.Sprintf("[%v, %v]", p[0]+body.X, p[1]+body.Y)
	}

	return fmt.Sprintf("[%s]", strings.Join(s, ", "))
}

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

func CalcPushbacks(oldDx, oldDy float64, playerShape, barrierShape *resolv.ConvexPolygon) (bool, float64, float64) {
	origX, origY := playerShape.Position()
	defer func() {
		playerShape.SetPosition(origX, origY)
	}()
	playerShape.SetPosition(origX+oldDx, origY+oldDy)
	overlapResult := &SatResult{
		Overlap:       0,
		OverlapX:      0,
		OverlapY:      0,
		AContainedInB: true,
		BContainedInA: true,
		Axis:          vector.Vector{0, 0},
	}
	if overlapped := IsPolygonPairOverlapped(playerShape, barrierShape, overlapResult); overlapped {
		pushbackX, pushbackY := overlapResult.Overlap*overlapResult.OverlapX, overlapResult.Overlap*overlapResult.OverlapY
		return true, pushbackX, pushbackY
	} else {
		return false, 0, 0
	}
}

type SatResult struct {
	Overlap       float64
	OverlapX      float64
	OverlapY      float64
	AContainedInB bool
	BContainedInA bool
	Axis          vector.Vector
}

func IsPolygonPairOverlapped(a, b *resolv.ConvexPolygon, result *SatResult) bool {
	aCnt, bCnt := len(a.Points), len(b.Points)
	// Single point case
	if 1 == aCnt && 1 == bCnt {
		if nil != result {
			result.Overlap = 0
		}
		return a.Points[0].X() == b.Points[0].X() && a.Points[0].Y() == b.Points[0].Y()
	}

	if 1 < aCnt {
		for _, axis := range a.SATAxes() {
			if isPolygonPairSeparatedByDir(a, b, axis.Unit(), result) {
				return false
			}
		}
	}

	if 1 < bCnt {
		for _, axis := range b.SATAxes() {
			if isPolygonPairSeparatedByDir(a, b, axis.Unit(), result) {
				return false
			}
		}
	}

	return true
}

func isPolygonPairSeparatedByDir(a, b *resolv.ConvexPolygon, e vector.Vector, result *SatResult) bool {
	/*
		[WARNING] This function is deliberately made private, it shouldn't be used alone (i.e. not along the norms of a polygon), otherwise the pushbacks calculated would be meaningless.

		Consider the following example
		a: {
			anchor: [1337.19 1696.74]
			points: [[0 0] [24 0] [24 24] [0 24]]
		},
		b: {
			anchor: [1277.72 1570.56]
			points: [[642.57 319.16] [0 319.16] [5.73 0] [643.75 0.90]]
		}

		e = (-2.98, 1.49).Unit()
	*/

	var aStart, aEnd, bStart, bEnd float64 = math.MaxFloat64, -math.MaxFloat64, math.MaxFloat64, -math.MaxFloat64
	for _, p := range a.Points {
		dot := (p.X()+a.X)*e.X() + (p.Y()+a.Y)*e.Y()

		if aStart > dot {
			aStart = dot
		}

		if aEnd < dot {
			aEnd = dot
		}
	}

	for _, p := range b.Points {
		dot := (p.X()+b.X)*e.X() + (p.Y()+b.Y)*e.Y()

		if bStart > dot {
			bStart = dot
		}

		if bEnd < dot {
			bEnd = dot
		}
	}

	if aStart > bEnd || aEnd < bStart {
		// Separated by unit vector "e"
		return true
	}

	if nil != result {
		result.Axis = e
		overlap := float64(0)

		if aStart < bStart {
			result.AContainedInB = false

			if aEnd < bEnd {
				overlap = aEnd - bStart
				result.BContainedInA = false
			} else {
				option1 := aEnd - bStart
				option2 := bEnd - aStart
				if option1 < option2 {
					overlap = option1
				} else {
					overlap = -option2
				}
			}
		} else {
			result.BContainedInA = false

			if aEnd > bEnd {
				overlap = aStart - bEnd
				result.AContainedInB = false
			} else {
				option1 := aEnd - bStart
				option2 := bEnd - aStart
				if option1 < option2 {
					overlap = option1
				} else {
					overlap = -option2
				}
			}
		}

		currentOverlap := result.Overlap
		absoluteOverlap := overlap
		if overlap < 0 {
			absoluteOverlap = -overlap
		}

		if 0 == currentOverlap || currentOverlap > absoluteOverlap {
			var sign float64 = 1
			if overlap < 0 {
				sign = -1
			}

			result.Overlap = absoluteOverlap
			result.OverlapX = e.X() * sign
			result.OverlapY = e.Y() * sign
		}
	}

	// the specified unit vector "e" doesn't separate "a" and "b", overlap result is generated
	return false
}
