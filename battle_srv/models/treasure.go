package models

import (
	"github.com/ByteArena/box2d"
)

type Treasure struct {
	Id              int32   `json:"id,omitempty"`
	LocalIdInBattle int32   `json:"localIdInBattle,omitempty"`
	Score           int32   `json:"score,omitempty"`
	X               float64 `json:"x,omitempty"`
	Y               float64 `json:"y,omitempty"`
	Removed         bool    `json:"removed,omitempty"`
	Type            int32   `json:"type,omitempty"`

	PickupBoundary *Polygon2D    `json:"-"`
	CollidableBody *box2d.B2Body `json:"-"`
}
