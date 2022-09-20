package models

import (
	"github.com/ByteArena/box2d"
)

type Bullet struct {
	LocalIdInBattle  int32         `json:"-"`
	LinearSpeed      float64       `json:"-"`
	X                float64       `json:"-"`
	Y                float64       `json:"-"`
	Removed          bool          `json:"-"`
	Dir              *Direction    `json:"-"`
	StartAtPoint     *Vec2D        `json:"-"`
	EndAtPoint       *Vec2D        `json:"-"`
	DamageBoundary   *Polygon2D    `json:"-"`
	CollidableBody   *box2d.B2Body `json:"-"`
	RemovedAtFrameId int32         `json:"-"`
}
