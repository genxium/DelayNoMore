package main

import (
	"github.com/gopherjs/gopherjs/js"
	. "jsexport/battle"
	"resolv"
)

/*
[WARNING] Should avoid using "MakeFullWrapper" as much as possible, and completely remove its usage in 60fps calls like "update(dt)" on frontend!
*/
func NewCollisionHolder() *js.Object {
	return js.MakeWrapper(resolv.NewCollision())
}

func NewInputFrameDownsync(inputFrameId int32, inputList []uint64, confirmedList uint64) *js.Object {
	return js.MakeWrapper(&InputFrameDownsync{
		InputFrameId:  inputFrameId,
		InputList:     inputList,
		ConfirmedList: confirmedList,
	})
}

func NewRingBufferJs(n int32) *js.Object {
	return js.MakeWrapper(resolv.NewRingBuffer(n))
}

func NewCollisionSpaceJs(spaceW, spaceH, minStepW, minStepH int) *js.Object {
	return js.MakeWrapper(resolv.NewSpace(spaceW, spaceH, minStepW, minStepH))
}

func NewVec2DJs(x, y float64) *js.Object {
	return js.MakeWrapper(&Vec2D{
		X: x,
		Y: y,
	})
}

func NewPolygon2DJs(anchor *Vec2D, points []*Vec2D) *js.Object {
	return js.MakeWrapper(&Polygon2D{
		Anchor: anchor,
		Points: points,
	})
}

func NewBarrierJs(boundary *Polygon2D) *js.Object {
	return js.MakeWrapper(&Barrier{
		Boundary: boundary,
	})
}

func NewPlayerDownsyncJs(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, framesToRecover, framesInChState, activeSkillId, activeSkillHit, framesInvinsible, speed, battleState, characterState, joinIndex, hp, maxHp, colliderRadius int32, inAir, onWall bool, onWallNormX, onWallNormY int32, capturedByInertia bool, bulletTeamId, chCollisionTeamId int32, revivalVirtualGridX, revivalVirtualGridY int32) *js.Object {
	return js.MakeWrapper(NewPlayerDownsync(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, framesToRecover, framesInChState, activeSkillId, activeSkillHit, framesInvinsible, speed, battleState, characterState, joinIndex, hp, maxHp, colliderRadius, inAir, onWall, onWallNormX, onWallNormY, capturedByInertia, bulletTeamId, chCollisionTeamId, revivalVirtualGridX, revivalVirtualGridY))
}

func NewMeleeBulletJs(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId, blState, framesInBlState, explosionFrames, speciesId int32) *js.Object {
	return js.MakeWrapper(NewMeleeBullet(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY, blowUp, teamId, blState, framesInBlState, explosionFrames, speciesId))
}

func NewFireballBulletJs(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId int32, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed, blState, framesInBlState, explosionFrames, speciesId int32) *js.Object {
	return js.MakeWrapper(NewFireballBullet(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY, blowUp, teamId, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed, blState, framesInBlState, explosionFrames, speciesId))
}

func NewNpcPatrolCue(flAct, frAct uint64, x, y float64) *js.Object {
	return js.MakeWrapper(&NpcPatrolCue{
		FlAct: flAct,
		FrAct: frAct,
		X:     x,
		Y:     y,
	})
}

func NewRoomDownsyncFrameJs(id int32, playersArr []*PlayerDownsync, bulletLocalIdCounter int32, meleeBullets []*MeleeBullet, fireballBullets []*FireballBullet) *js.Object {
	// [WARNING] Avoid using "pb.RoomDownsyncFrame" here, in practive "MakeFullWrapper" doesn't expose the public fields for a "protobuf struct" as expected and requires helper functions like "GetCollisionSpaceObjsJs".
	return js.MakeWrapper(&RoomDownsyncFrame{
		Id:                   id,
		BulletLocalIdCounter: bulletLocalIdCounter,
		PlayersArr:           playersArr,
		MeleeBullets:         meleeBullets,
		FireballBullets:      fireballBullets,
	})
}

func GetCollisionSpaceObjsJs(space *resolv.Space) []*js.Object {
	// [WARNING] We couldn't just use the existing method "space.Objects()" to access them in JavaScript, there'd a stackoverflow error
	objs := space.Objects()
	ret := make([]*js.Object, len(objs))
	for i, obj := range objs {
		ret[i] = js.MakeWrapper(obj)
	}
	return ret
}

func GenerateConvexPolygonColliderJs(unalignedSrc *Polygon2D, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *js.Object {
	return js.MakeWrapper(GenerateConvexPolygonCollider(unalignedSrc, spaceOffsetX, spaceOffsetY, data, tag))
}

func GetCharacterConfigsOrderedByJoinIndex(speciesIdList []int) []*js.Object {
	ret := make([]*js.Object, len(speciesIdList), len(speciesIdList))
	for i, speciesId := range speciesIdList {
		ret[i] = js.MakeWrapper(Characters[speciesId])
	}
	return ret
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(inputsBuffer *resolv.RingBuffer, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, collisionSpaceOffsetX, collisionSpaceOffsetY float64, chConfigsOrderedByJoinIndex []*CharacterConfig) *js.Object {
	// We need access to all fields of RoomDownsyncFrame for displaying in frontend
	return js.MakeWrapper(ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer, currRenderFrame, collisionSys, collisionSysMap, collisionSpaceOffsetX, collisionSpaceOffsetY, chConfigsOrderedByJoinIndex))
}

func main() {
	js.Global.Set("gopkgs", map[string]interface{}{
		"NewVec2DJs":                            NewVec2DJs,
		"NewPolygon2DJs":                        NewPolygon2DJs,
		"NewBarrierJs":                          NewBarrierJs,
		"NewPlayerDownsyncJs":                   NewPlayerDownsyncJs,
		"NewMeleeBulletJs":                      NewMeleeBulletJs,
		"NewFireballBulletJs":                   NewFireballBulletJs,
		"NewNpcPatrolCue":                       NewNpcPatrolCue,
		"NewRoomDownsyncFrameJs":                NewRoomDownsyncFrameJs,
		"NewCollisionSpaceJs":                   NewCollisionSpaceJs,
		"NewInputFrameDownsync":                 NewInputFrameDownsync,
		"NewRingBufferJs":                       NewRingBufferJs,
		"GenerateConvexPolygonColliderJs":       GenerateConvexPolygonColliderJs,
		"GetCollisionSpaceObjsJs":               GetCollisionSpaceObjsJs,
		"WorldToPolygonColliderBLPos":           WorldToPolygonColliderBLPos, // No need to wrap primitive return types
		"PolygonColliderBLToWorldPos":           PolygonColliderBLToWorldPos,
		"WorldToVirtualGridPos":                 WorldToVirtualGridPos,
		"VirtualGridToWorldPos":                 VirtualGridToWorldPos,
		"GetCharacterConfigsOrderedByJoinIndex": GetCharacterConfigsOrderedByJoinIndex,
		"ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs": ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs,
		"ConvertToDelayedInputFrameId":                         ConvertToDelayedInputFrameId,
		"ConvertToNoDelayInputFrameId":                         ConvertToNoDelayInputFrameId,
		"ConvertToFirstUsedRenderFrameId":                      ConvertToFirstUsedRenderFrameId,
		"ConvertToLastUsedRenderFrameId":                       ConvertToLastUsedRenderFrameId,
		"ShouldGenerateInputFrameUpsync":                       ShouldGenerateInputFrameUpsync,
		"IsGeneralBulletActive":                                IsGeneralBulletActive,
	})
}
