package main

import (
	"github.com/gopherjs/gopherjs/js"
	"github.com/solarlune/resolv"
	. "jsexport/battle"
)

func NewCollisionSpaceJs(spaceW, spaceH, minStepW, minStepH int) *js.Object {
	return js.MakeWrapper(resolv.NewSpace(spaceW, spaceH, minStepW, minStepH))
}

func NewVec2DJs(x, y float64) *js.Object {
	return js.MakeFullWrapper(&Vec2D{
		X: x,
		Y: y,
	})
}

func NewPolygon2DJs(anchor *Vec2D, points []*Vec2D) *js.Object {
	return js.MakeFullWrapper(&Polygon2D{
		Anchor: anchor,
		Points: points,
	})
}

func NewBarrierJs(boundary *Polygon2D) *js.Object {
	return js.MakeWrapper(&Barrier{
		Boundary: boundary,
	})
}

func NewPlayerDownsyncJs(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed, battleState, characterState, joinIndex, hp, maxHp int32, inAir bool, colliderRadius float64) *js.Object {
	return js.MakeWrapper(&PlayerDownsync{
		Id:             id,
		VirtualGridX:   virtualGridX,
		VirtualGridY:   virtualGridY,
		DirX:           dirX,
		DirY:           dirY,
		VelX:           velX,
		VelY:           velY,
		Speed:          speed,
		BattleState:    battleState,
		JoinIndex:      joinIndex,
		ColliderRadius: colliderRadius,
		Hp:             hp,
		MaxHp:          maxHp,
		CharacterState: characterState,
		InAir:          inAir,
	})
}

func NewRoomDownsyncFrameJs(id int32, playersArr []*PlayerDownsync, meleeBullets []*MeleeBullet) *js.Object {
	return js.MakeFullWrapper(&RoomDownsyncFrame{
		Id:           id,
		PlayersArr:   playersArr,
		MeleeBullets: meleeBullets,
	})
}

func NewInputFrameDownsyncJs(inputFrameId int32, inputList []uint64, confirmedList uint64) *js.Object {
	return js.MakeFullWrapper(&InputFrameDownsync{
		InputFrameId:  inputFrameId,
		InputList:     inputList,
		ConfirmedList: confirmedList,
	})
}

func GetCollisionSpaceObjsJs(space *resolv.Space) []*js.Object {
	objs := space.Objects()
	ret := make([]*js.Object, 0, len(objs))
	for _, obj := range objs {
		ret = append(ret, js.MakeFullWrapper(obj))
	}
	return ret
}

func GetPlayersArrJs(rdf *RoomDownsyncFrame) []*js.Object {
	// We couldn't just use the existing getters or field names to access non-primitive fields in Js
	ret := make([]*js.Object, 0, len(rdf.PlayersArr))
	for _, player := range rdf.PlayersArr {
		ret = append(ret, js.MakeFullWrapper(player))
	}
	return ret
}

func GenerateRectColliderJs(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *js.Object {
	/*
			   [WARNING] It's important to note that we don't need "js.MakeFullWrapper" for a call sequence as follows.
			   ```
			       var space = gopkgs.NewCollisionSpaceJs(2048, 2048, 8, 8);
			       var a = gopkgs.GenerateRectColliderJs(189, 497, 48, 48, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, spaceOffsetX, spaceOffsetY, "Player");
			       space.Add(a);
			   ```
			   The "space" variable doesn't need access to the field of "a" in JavaScript level to run "space.Add(...)" method, which is good.

		       However, the full wrapper access here is used for updating "collider.X/collider.Y" at JavaScript runtime.
	*/
	return js.MakeFullWrapper(GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY, data, tag))

}

func GenerateConvexPolygonColliderJs(unalignedSrc *Polygon2D, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *js.Object {
	return js.MakeFullWrapper(GenerateConvexPolygonCollider(unalignedSrc, spaceOffsetX, spaceOffsetY, data, tag))
}

func CheckCollisionJs(obj *resolv.Object, dx, dy float64) *js.Object {
	// TODO: Support multiple tags in the future
	// Unfortunately I couldn't find a way to just call "var a = GenerateRectColliderJs(...); space.Add(a); a.Check(...)" to get the collision result, the unwrapped method will result in stack overflow. Need a better solution later.
	return js.MakeFullWrapper(obj.Check(dx, dy))
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(delayedInputFrame, delayedInputFrameForPrevRenderFrame *InputFrameDownsync, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, gravityX, gravityY, jumpingInitVelY, inputDelayFrames, inputScaleFrames int32, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio float64) *js.Object {
	// We need access to all fields of RoomDownsyncFrame for displaying in frontend
	return js.MakeFullWrapper(ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, delayedInputFrameForPrevRenderFrame, currRenderFrame, collisionSys, collisionSysMap, gravityX, gravityY, jumpingInitVelY, inputDelayFrames, inputScaleFrames, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio))
}

func main() {
	js.Global.Set("gopkgs", map[string]interface{}{
		"NewVec2DJs":                      NewVec2DJs,
		"NewPolygon2DJs":                  NewPolygon2DJs,
		"NewBarrierJs":                    NewBarrierJs,
		"NewPlayerDownsyncJs":             NewPlayerDownsyncJs,
		"NewRoomDownsyncFrameJs":          NewRoomDownsyncFrameJs,
		"NewCollisionSpaceJs":             NewCollisionSpaceJs,
		"NewInputFrameDownsyncJs":         NewInputFrameDownsyncJs,
		"GenerateRectColliderJs":          GenerateRectColliderJs,
		"GenerateConvexPolygonColliderJs": GenerateConvexPolygonColliderJs,
		"GetPlayersArrJs":                 GetPlayersArrJs,
		"GetCollisionSpaceObjsJs":         GetCollisionSpaceObjsJs,
		"ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs": ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs,
		"WorldToPolygonColliderBLPos":                          WorldToPolygonColliderBLPos, // No need to wrap primitive return types
		"PolygonColliderBLToWorldPos":                          PolygonColliderBLToWorldPos,
		"CheckCollisionJs":                                     CheckCollisionJs,
	})
}
