package models

import (
	"github.com/ByteArena/box2d"
)

type Barrier struct {
	X              float64
	Y              float64
	Type           uint32
	Boundary       *Polygon2D
	CollidableBody *box2d.B2Body
}
