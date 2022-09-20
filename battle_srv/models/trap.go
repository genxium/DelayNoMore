package models

import (
	"github.com/ByteArena/box2d"
)

type Trap struct {
	Id               int32         `json:"id,omitempty"`
	LocalIdInBattle  int32         `json:"localIdInBattle,omitempty"`
	Type             int32         `json:"type,omitempty"`
	X                float64       `json:"x,omitempty"`
	Y                float64       `json:"y,omitempty"`
	Removed          bool          `json:"removed,omitempty"`
	PickupBoundary   *Polygon2D    `json:"-"`
	TrapBullets      []*Bullet     `json:"-"`
	CollidableBody   *box2d.B2Body `json:"-"`
	RemovedAtFrameId int32         `json:"-"`
}

type GuardTower struct {
	Id               int32         `json:"id,omitempty"`
	LocalIdInBattle  int32         `json:"localIdInBattle,omitempty"`
	Type             int32         `json:"type,omitempty"`
	X                float64       `json:"x,omitempty"`
	Y                float64       `json:"y,omitempty"`
	Removed          bool          `json:"removed,omitempty"`
	PickupBoundary   *Polygon2D    `json:"-"`
	TrapBullets      []*Bullet     `json:"-"`
	CollidableBody   *box2d.B2Body `json:"-"`
	RemovedAtFrameId int32         `json:"-"`

	InRangePlayers *InRangePlayerCollection `json:"-"`
	LastAttackTick int64                    `json:"-"`

	TileWidth       float64 `json:"-"`
	TileHeight      float64 `json:"-"`
	WidthInB2World  float64 `json:"-"`
	HeightInB2World float64 `json:"-"`
}
