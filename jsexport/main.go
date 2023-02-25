package main

import (
	"github.com/gopherjs/gopherjs/js"
	. "jsexport/battle"
	"resolv"
)

/*
[WARNING] Should avoid using "MakeFullWrapper" as much as possible, and completely remove its usage in 60fps calls like "update(dt)" on frontend!
*/
func NewDynamicRectangleColliders(cnt int) []*js.Object {
	ret := make([]*js.Object, cnt)
	for i := 0; i < cnt; i++ {
		ret[i] = js.MakeWrapper(GenerateRectCollider(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, nil, ""))
	}
	return ret
}

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
	preallocatedRdf := NewPreallocatedRoomDownsyncFrame(len(playersArr), 64, 64)
	CloneRoomDownsyncFrame(id, playersArr, bulletLocalIdCounter, meleeBullets, fireballBullets, preallocatedRdf)
	return js.MakeWrapper(preallocatedRdf)
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
		ret[i] = js.MakeFullWrapper(Characters[speciesId])
	}
	return ret
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(inputsBuffer *resolv.RingBuffer, currRenderFrameId int32, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, collisionSpaceOffsetX, collisionSpaceOffsetY float64, chConfigsOrderedByJoinIndex []*CharacterConfig, renderFrameBuffer *resolv.RingBuffer, collision *resolv.Collision, effPushbacks []*Vec2D, hardPushbackNormsArr [][]*Vec2D, jumpedOrNotList []bool, dynamicRectangleColliders []*resolv.Object, lastIndividuallyConfirmedInputFrameId []int32, lastIndividuallyConfirmedInputList []uint64, allowUpdateInputFrameInPlaceUponDynamics bool) bool {
	// We need access to all fields of RoomDownsyncFrame for displaying in frontend
	return ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer, currRenderFrameId, collisionSys, collisionSysMap, collisionSpaceOffsetX, collisionSpaceOffsetY, chConfigsOrderedByJoinIndex, renderFrameBuffer, collision, effPushbacks, hardPushbackNormsArr, jumpedOrNotList, dynamicRectangleColliders, lastIndividuallyConfirmedInputFrameId, lastIndividuallyConfirmedInputList, allowUpdateInputFrameInPlaceUponDynamics)
}

func GetRoomDownsyncFrame(renderFrameBuffer *resolv.RingBuffer, frameId int32) *js.Object {
	// [WARNING] Calling "renderFrameBuffer.GetByFrameId(frameId)" directly from transpiled frontend code would automatically invoke the expensive "$externalize" and "$mapArray"! See profiling result for more details.
	candidate := renderFrameBuffer.GetByFrameId(frameId)
	if nil == candidate {
		return nil
	}
	return js.MakeWrapper(candidate.(*RoomDownsyncFrame))
}

func GetInputFrameDownsync(inputsBuffer *resolv.RingBuffer, inputFrameId int32) *js.Object {
	candidate := inputsBuffer.GetByFrameId(inputFrameId)
	if nil == candidate {
		return nil
	}
	return js.MakeWrapper(candidate.(*InputFrameDownsync))
}

func GetInput(ifd *InputFrameDownsync, i int) uint64 {
	// [WARNING] Calling "ifd.GetInputList()" directly from transpiled frontend code would make a copy of the array.
	return ifd.InputList[i]
}

func SetInputFrameId(ifd *InputFrameDownsync, newVal int32) bool {
	// [WARNING] This function should be only used by frontend which is single-threaded; on the backend more rigorous thread-safety concerns are taken care of by proper locking.
	ifd.InputFrameId = newVal
	return true
}

func SetInput(ifd *InputFrameDownsync, i int, newVal uint64) bool {
	// [WARNING] This function should be only used by frontend which is single-threaded; on the backend more rigorous thread-safety concerns are taken care of by proper locking.
	if i >= len(ifd.InputList) {
		return false
	}

	ifd.InputList[i] = newVal
	return true
}

func SetConfirmedList(ifd *InputFrameDownsync, newVal uint64) bool {
	// [WARNING] This function should be only used by frontend which is single-threaded; on the backend more rigorous thread-safety concerns are taken care of by proper locking.
	ifd.ConfirmedList = newVal
	return true
}

func GetPlayer(rdf *RoomDownsyncFrame, i int) *js.Object {
	// [WARNING] Calling "rdf.GetPlayersArr()" directly from transpiled frontend code would automatically invoke the expensive "$externalize" and "$mapArray"! See profiling result for more details.
	return js.MakeWrapper(rdf.PlayersArr[i])
}

func GetMeleeBullet(rdf *RoomDownsyncFrame, i int) *js.Object {
	if TERMINATING_BULLET_LOCAL_ID == rdf.MeleeBullets[i].GetBulletLocalId() {
		return nil
	}
	return js.MakeWrapper(rdf.MeleeBullets[i])
}

func GetFireballBullet(rdf *RoomDownsyncFrame, i int) *js.Object {
	if TERMINATING_BULLET_LOCAL_ID == rdf.FireballBullets[i].GetBulletLocalId() {
		return nil
	}
	return js.MakeWrapper(rdf.FireballBullets[i])
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
		"NewCollisionHolder":                    NewCollisionHolder,
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
		"GetRoomDownsyncFrame":                                 GetRoomDownsyncFrame,
		"GetInputFrameDownsync":                                GetInputFrameDownsync,
		"GetPlayer":                                            GetPlayer,
		"GetMeleeBullet":                                       GetMeleeBullet,
		"GetFireballBullet":                                    GetFireballBullet,
		"GetInput":                                             GetInput,
		"NewDynamicRectangleColliders":                         NewDynamicRectangleColliders,
		"SetInputFrameId":                                      SetInputFrameId,
		"SetInput":                                             SetInput,
		"SetConfirmedList":                                     SetConfirmedList,
	})
}
