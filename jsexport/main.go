package main

import (
	"github.com/gopherjs/gopherjs/js"
	. "jsexport/battle"
	"resolv"
)

func NewInputFrameDownsync(inputFrameId int32, inputList []uint64, confirmedList uint64) *js.Object {
	return js.MakeFullWrapper(&InputFrameDownsync{
		InputFrameId:  inputFrameId,
		InputList:     inputList,
		ConfirmedList: confirmedList,
	})
}

func NewRingBufferJs(n int32) *js.Object {
	return js.MakeFullWrapper(NewRingBuffer(n))
}

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

func NewPlayerDownsyncJs(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, framesToRecover, framesInChState, activeSkillId, activeSkillHit, framesInvinsible, speed, battleState, characterState, joinIndex, hp, maxHp, colliderRadius int32, inAir bool, bulletTeamId, chCollisionTeamId int32) *js.Object {
	return js.MakeWrapper(&PlayerDownsync{
		Id:                id,
		VirtualGridX:      virtualGridX,
		VirtualGridY:      virtualGridY,
		DirX:              dirX,
		DirY:              dirY,
		VelX:              velX,
		VelY:              velY,
		FramesToRecover:   framesToRecover,
		FramesInChState:   framesInChState,
		ActiveSkillId:     activeSkillId,
		ActiveSkillHit:    activeSkillHit,
		FramesInvinsible:  framesInvinsible,
		Speed:             speed,
		BattleState:       battleState,
		CharacterState:    characterState,
		JoinIndex:         joinIndex,
		Hp:                hp,
		MaxHp:             maxHp,
		ColliderRadius:    colliderRadius,
		InAir:             inAir,
		BulletTeamId:      bulletTeamId,
		ChCollisionTeamId: chCollisionTeamId,
	})
}

func NewMeleeBulletJs(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId int32) *js.Object {
	return js.MakeWrapper(&MeleeBullet{
		Bullet: Bullet{
			BulletLocalId:           bulletLocalId,
			OriginatedRenderFrameId: originatedRenderFrameId,
			OffenderJoinIndex:       offenderJoinIndex,

			StartupFrames:      startupFrames,
			CancellableStFrame: cancellableStFrame,
			CancellableEdFrame: cancellableEdFrame,
			ActiveFrames:       activeFrames,

			HitStunFrames:   hitStunFrames,
			BlockStunFrames: blockStunFrames,
			PushbackVelX:    pushbackVelX,
			PushbackVelY:    pushbackVelY,
			Damage:          damage,

			SelfLockVelX: selfLockVelX,
			SelfLockVelY: selfLockVelY,

			HitboxOffsetX: hitboxOffsetX,
			HitboxOffsetY: hitboxOffsetY,
			HitboxSizeX:   hitboxSizeX,
			HitboxSizeY:   hitboxSizeY,

			BlowUp: blowUp,

			TeamId: teamId,
		},
	})
}

func NewFireballBulletJs(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId int32, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed int32) *js.Object {
	return js.MakeWrapper(&FireballBullet{
		VirtualGridX: virtualGridX,
		VirtualGridY: virtualGridY,
		DirX:         dirX,
		DirY:         dirY,
		VelX:         velX,
		VelY:         velY,
		Speed:        speed,
		Bullet: Bullet{
			BulletLocalId:           bulletLocalId,
			OriginatedRenderFrameId: originatedRenderFrameId,
			OffenderJoinIndex:       offenderJoinIndex,

			StartupFrames:      startupFrames,
			CancellableStFrame: cancellableStFrame,
			CancellableEdFrame: cancellableEdFrame,
			ActiveFrames:       activeFrames,

			HitStunFrames:   hitStunFrames,
			BlockStunFrames: blockStunFrames,
			PushbackVelX:    pushbackVelX,
			PushbackVelY:    pushbackVelY,
			Damage:          damage,

			SelfLockVelX: selfLockVelX,
			SelfLockVelY: selfLockVelY,

			HitboxOffsetX: hitboxOffsetX,
			HitboxOffsetY: hitboxOffsetY,
			HitboxSizeX:   hitboxSizeX,
			HitboxSizeY:   hitboxSizeY,

			BlowUp: blowUp,

			TeamId: teamId,
		},
	})
}

func NewNpcPatrolCue(flAct, frAct uint64, x, y float64) *js.Object {
	return js.MakeFullWrapper(&NpcPatrolCue{
		FlAct: flAct,
		FrAct: frAct,
		X:     x,
		Y:     y,
	})
}

func NewRoomDownsyncFrameJs(id int32, playersArr []*PlayerDownsync, bulletLocalIdCounter int32, meleeBullets []*MeleeBullet, fireballBullets []*FireballBullet) *js.Object {
	// [WARNING] Avoid using "pb.RoomDownsyncFrame" here, in practive "MakeFullWrapper" doesn't expose the public fields for a "protobuf struct" as expected and requires helper functions like "GetCollisionSpaceObjsJs".
	return js.MakeFullWrapper(&RoomDownsyncFrame{
		Id:                   id,
		PlayersArr:           playersArr,
		BulletLocalIdCounter: bulletLocalIdCounter,
		MeleeBullets:         meleeBullets,
		FireballBullets:      fireballBullets,
	})
}

func GetCollisionSpaceObjsJs(space *resolv.Space) []*js.Object {
	// [WARNING] We couldn't just use the existing method "space.Objects()" to access them in JavaScript, there'd a stackoverflow error
	objs := space.Objects()
	ret := make([]*js.Object, 0, len(objs))
	for _, obj := range objs {
		ret = append(ret, js.MakeFullWrapper(obj))
	}
	return ret
}

func GenerateRectColliderJs(wx, wy, w, h, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *js.Object {
	/*
			   [WARNING] It's important to note that we don't need "js.MakeFullWrapper" for a call sequence as follows.
			   ```
			       var space = gopkgs.NewCollisionSpaceJs(2048, 2048, 8, 8);
			       var a = gopkgs.GenerateRectColliderJs(189, 497, 48, 48, spaceOffsetX, spaceOffsetY, "Player");
			       space.Add(a);
			   ```
			   The "space" variable doesn't need access to the field of "a" in JavaScript level to run "space.Add(...)" method, which is good.

		       However, the full wrapper access here is used for updating "collider.X/collider.Y" at JavaScript runtime.
	*/
	topPadding, bottomPadding, leftPadding, rightPadding := SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP
	return js.MakeFullWrapper(GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY, data, tag))

}

func GenerateConvexPolygonColliderJs(unalignedSrc *Polygon2D, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *js.Object {
	return js.MakeFullWrapper(GenerateConvexPolygonCollider(unalignedSrc, spaceOffsetX, spaceOffsetY, data, tag))
}

func GetCharacterConfigsOrderedByJoinIndex(speciesIdList []int) []*js.Object {
	ret := make([]*js.Object, len(speciesIdList), len(speciesIdList))
	for i, speciesId := range speciesIdList {
		ret[i] = js.MakeFullWrapper(Characters[speciesId])
	}
	return ret
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs(inputsBuffer *RingBuffer, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, collisionSpaceOffsetX, collisionSpaceOffsetY float64, chConfigsOrderedByJoinIndex []*CharacterConfig) *js.Object {
	// We need access to all fields of RoomDownsyncFrame for displaying in frontend
	return js.MakeFullWrapper(ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer, currRenderFrame, collisionSys, collisionSysMap, collisionSpaceOffsetX, collisionSpaceOffsetY, chConfigsOrderedByJoinIndex))
}

func main() {
	js.Global.Set("gopkgs", map[string]interface{}{
		"NewVec2DJs":                                           NewVec2DJs,
		"NewPolygon2DJs":                                       NewPolygon2DJs,
		"NewBarrierJs":                                         NewBarrierJs,
		"NewPlayerDownsyncJs":                                  NewPlayerDownsyncJs,
		"NewMeleeBulletJs":                                     NewMeleeBulletJs,
		"NewFireballBulletJs":                                  NewFireballBulletJs,
		"NewNpcPatrolCue":                                      NewNpcPatrolCue,
		"NewRoomDownsyncFrameJs":                               NewRoomDownsyncFrameJs,
		"NewCollisionSpaceJs":                                  NewCollisionSpaceJs,
		"NewInputFrameDownsync":                                NewInputFrameDownsync,
		"NewRingBufferJs":                                      NewRingBufferJs,
		"GenerateRectColliderJs":                               GenerateRectColliderJs,
		"GenerateConvexPolygonColliderJs":                      GenerateConvexPolygonColliderJs,
		"GetCollisionSpaceObjsJs":                              GetCollisionSpaceObjsJs,
		"WorldToPolygonColliderBLPos":                          WorldToPolygonColliderBLPos, // No need to wrap primitive return types
		"PolygonColliderBLToWorldPos":                          PolygonColliderBLToWorldPos,
		"WorldToVirtualGridPos":                                WorldToVirtualGridPos,
		"VirtualGridToWorldPos":                                VirtualGridToWorldPos,
		"GetCharacterConfigsOrderedByJoinIndex":                GetCharacterConfigsOrderedByJoinIndex,
		"ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs": ApplyInputFrameDownsyncDynamicsOnSingleRenderFrameJs,
		"ConvertToDelayedInputFrameId":                         ConvertToDelayedInputFrameId,
		"ConvertToNoDelayInputFrameId":                         ConvertToNoDelayInputFrameId,
		"ConvertToFirstUsedRenderFrameId":                      ConvertToFirstUsedRenderFrameId,
		"ConvertToLastUsedRenderFrameId":                       ConvertToLastUsedRenderFrameId,
		"ShouldGenerateInputFrameUpsync":                       ShouldGenerateInputFrameUpsync,
	})
}
