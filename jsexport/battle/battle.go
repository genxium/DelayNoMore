package battle

import (
	"math"
	"resolv"
)

const (
	MAX_FLOAT64                    = 1.7e+308
	COLLISION_PLAYER_INDEX_PREFIX  = (1 << 17)
	COLLISION_BARRIER_INDEX_PREFIX = (1 << 16)
	COLLISION_BULLET_INDEX_PREFIX  = (1 << 15)

	PATTERN_ID_UNABLE_TO_OP = -2
	PATTERN_ID_NO_OP        = -1
)

// These directions are chosen such that when speed is changed to "(speedX+delta, speedY+delta)" for any of them, the direction is unchanged.
var DIRECTION_DECODER = [][]int32{
	{0, 0},
	{0, +2},
	{0, -2},
	{+2, 0},
	{-2, 0},
	{+1, +1},
	{-1, -1},
	{+1, -1},
	{-1, +1},
}

var skillIdToBullet = map[int]interface{}{
	1: &MeleeBullet{
		Bullet: Bullet{
			// for offender
			StartupFrames:         int32(5),
			ActiveFrames:          int32(10),
			RecoveryFrames:        int32(34),
			RecoveryFramesOnBlock: int32(34),
			RecoveryFramesOnHit:   int32(34),
			HitboxOffset:          float64(12.0), // should be about the radius of the PlayerCollider

			// for defender
			HitStunFrames:      int32(18),
			BlockStunFrames:    int32(9),
			Pushback:           float64(8.0),
			ReleaseTriggerType: int32(1), // 1: rising-edge, 2: falling-edge
			Damage:             int32(5),

			SelfMoveforwardX: 0,
			SelfMoveforwardY: 0,
			HitboxSizeX:      24.0,
			HitboxSizeY:      32.0,
		},
	},
}

const (
	ATK_CHARACTER_STATE_IDLE1        = int32(0)
	ATK_CHARACTER_STATE_WALKING      = int32(1)
	ATK_CHARACTER_STATE_ATK1         = int32(2)
	ATK_CHARACTER_STATE_ATKED1       = int32(3)
	ATK_CHARACTER_STATE_INAIR_IDLE1  = int32(4)
	ATK_CHARACTER_STATE_INAIR_ATK1   = int32(5)
	ATK_CHARACTER_STATE_INAIR_ATKED1 = int32(6)
)

func ConvertToInputFrameId(renderFrameId int32, inputDelayFrames int32, inputScaleFrames uint32) int32 {
	if renderFrameId < inputDelayFrames {
		return 0
	}
	return ((renderFrameId - inputDelayFrames) >> inputScaleFrames)
}

func decodeInput(encodedInput uint64) *InputFrameDecoded {
	encodedDirection := (encodedInput & uint64(15))
	btnALevel := int32((encodedInput >> 4) & 1)
	btnBLevel := int32((encodedInput >> 5) & 1)
	return &InputFrameDecoded{
		Dx:        DIRECTION_DECODER[encodedDirection][0],
		Dy:        DIRECTION_DECODER[encodedDirection][1],
		BtnALevel: btnALevel,
		BtnBLevel: btnBLevel,
	}
}

type SatResult struct {
	Overlap       float64
	OverlapX      float64
	OverlapY      float64
	AContainedInB bool
	BContainedInA bool
	Axis          resolv.Vector
}

func CalcPushbacks(oldDx, oldDy float64, playerShape, barrierShape *resolv.ConvexPolygon) (bool, float64, float64, *SatResult) {
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
		Axis:          resolv.Vector{0, 0},
	}
	if overlapped := isPolygonPairOverlapped(playerShape, barrierShape, overlapResult); overlapped {
		pushbackX, pushbackY := overlapResult.Overlap*overlapResult.OverlapX, overlapResult.Overlap*overlapResult.OverlapY
		return true, pushbackX, pushbackY, overlapResult
	} else {
		return false, 0, 0, overlapResult
	}
}

func isPolygonPairOverlapped(a, b *resolv.ConvexPolygon, result *SatResult) bool {
	aCnt, bCnt := len(a.Points), len(b.Points)
	// Single point case
	if 1 == aCnt && 1 == bCnt {
		if nil != result {
			result.Overlap = 0
		}
		return a.Points[0][0] == b.Points[0][0] && a.Points[0][1] == b.Points[0][1]
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

func isPolygonPairSeparatedByDir(a, b *resolv.ConvexPolygon, e resolv.Vector, result *SatResult) bool {
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

	var aStart, aEnd, bStart, bEnd float64 = MAX_FLOAT64, -MAX_FLOAT64, MAX_FLOAT64, -MAX_FLOAT64
	for _, p := range a.Points {
		dot := (p[0]+a.X)*e[0] + (p[1]+a.Y)*e[1]

		if aStart > dot {
			aStart = dot
		}

		if aEnd < dot {
			aEnd = dot
		}
	}

	for _, p := range b.Points {
		dot := (p[0]+b.X)*e[0] + (p[1]+b.Y)*e[1]

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

		if (0 == result.Axis[0] && 0 == result.Axis[1]) || currentOverlap > absoluteOverlap {
			var sign float64 = 1
			if overlap < 0 {
				sign = -1
			}

			result.Overlap = absoluteOverlap
			result.OverlapX = e[0] * sign
			result.OverlapY = e[1] * sign
		}

		result.Axis = e
	}

	// the specified unit vector "e" doesn't separate "a" and "b", overlap result is generated
	return false
}

func WorldToVirtualGridPos(wx, wy, worldToVirtualGridRatio float64) (int32, int32) {
	// [WARNING] Introduces loss of precision!
	// In JavaScript floating numbers suffer from seemingly non-deterministic arithmetics, and even if certain libs solved this issue by approaches such as fixed-point-number, they might not be used in other libs -- e.g. the "collision libs" we're interested in -- thus couldn't kill all pains.
	var virtualGridX int32 = int32(math.Floor(wx * worldToVirtualGridRatio))
	var virtualGridY int32 = int32(math.Floor(wy * worldToVirtualGridRatio))
	return virtualGridX, virtualGridY
}

func VirtualGridToWorldPos(vx, vy int32, virtualGridToWorldRatio float64) (float64, float64) {
	// No loss of precision
	var wx float64 = float64(vx) * virtualGridToWorldRatio
	var wy float64 = float64(vy) * virtualGridToWorldRatio
	return wx, wy
}

func WorldToPolygonColliderBLPos(wx, wy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (float64, float64) {
	return wx - halfBoundingW - leftPadding + collisionSpaceOffsetX, wy - halfBoundingH - bottomPadding + collisionSpaceOffsetY
}

func PolygonColliderBLToWorldPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (float64, float64) {
	return cx + halfBoundingW + leftPadding - collisionSpaceOffsetX, cy + halfBoundingH + bottomPadding - collisionSpaceOffsetY
}

func PolygonColliderBLToVirtualGridPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64, worldToVirtualGridRatio float64) (int32, int32) {
	wx, wy := PolygonColliderBLToWorldPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY)
	return WorldToVirtualGridPos(wx, wy, worldToVirtualGridRatio)
}

func VirtualGridToPolygonColliderBLPos(vx, vy int32, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64, virtualGridToWorldRatio float64) (float64, float64) {
	wx, wy := VirtualGridToWorldPos(vx, vy, virtualGridToWorldRatio)
	return WorldToPolygonColliderBLPos(wx, wy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY)
}

func calcHardPushbacksNorms(joinIndex int32, playerCollider *resolv.Object, playerShape *resolv.ConvexPolygon, snapIntoPlatformOverlap float64, pEffPushback *Vec2D) *[]Vec2D {
	ret := make([]Vec2D, 0, 10) // no one would simultaneously have more than 5 hardPushbacks
	collision := playerCollider.Check(0, 0)
	if nil == collision {
		return &ret
	}

	//playerColliderCenterX, playerColliderCenterY := playerCollider.Center()
	//fmt.Printf("joinIndex=%d calcHardPushbacksNorms has non-empty collision;playerColliderPos=(%.2f,%.2f)\n", joinIndex, playerColliderCenterX, playerColliderCenterY)
	for _, obj := range collision.Objects {
		isBarrier := false
		switch obj.Data.(type) {
		case *PlayerDownsync:
		case *MeleeBullet:
		default:
			// By default it's a regular barrier, even if data is nil, note that Golang syntax of switch-case is kind of confusing, this "default" condition is met only if "!*PlayerDownsync && !*MeleeBullet".
			isBarrier = true
		}

		if !isBarrier {
			continue
		}
		barrierShape := obj.Shape.(*resolv.ConvexPolygon)
		overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(0, 0, playerShape, barrierShape)
		if !overlapped {
			continue
		}
		// ALWAY snap into hardPushbacks!
		// [OverlapX, OverlapY] is the unit vector that points into the platform
		pushbackX, pushbackY = (overlapResult.Overlap-snapIntoPlatformOverlap)*overlapResult.OverlapX, (overlapResult.Overlap-snapIntoPlatformOverlap)*overlapResult.OverlapY
		ret = append(ret, Vec2D{X: overlapResult.OverlapX, Y: overlapResult.OverlapY})
		pEffPushback.X += pushbackX
		pEffPushback.Y += pushbackY
		//fmt.Printf("joinIndex=%d calcHardPushbacksNorms found one hardpushback; immediatePushback=(%.2f,%.2f)\n", joinIndex, pushbackX, pushbackY)
	}
	return &ret
}

func deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame *PlayerDownsync, currRenderFrame *RoomDownsyncFrame, inputsBuffer *RingBuffer, inputDelayFrames int32, inputScaleFrames uint32) (int, bool, int32, int32) {
	// returns (patternId, jumpedOrNot, effectiveDx, effectiveDy)
	delayedInputFrameId := ConvertToInputFrameId(currRenderFrame.Id, inputDelayFrames, inputScaleFrames)
	delayedInputFrameIdForPrevRdf := ConvertToInputFrameId(currRenderFrame.Id-1, inputDelayFrames, inputScaleFrames)

	if 0 >= delayedInputFrameId {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}

	delayedInputList := inputsBuffer.GetByFrameId(delayedInputFrameId).(*InputFrameDownsync).InputList
	var delayedInputListForPrevRdf []uint64 = nil
	if 0 < delayedInputFrameIdForPrevRdf {
		delayedInputListForPrevRdf = inputsBuffer.GetByFrameId(delayedInputFrameIdForPrevRdf).(*InputFrameDownsync).InputList
	}

	jumpedOrNot := false
	joinIndex := currPlayerDownsync.JoinIndex
	if 0 < currPlayerDownsync.FramesToRecover {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}
	decodedInput := decodeInput(delayedInputList[joinIndex-1])
	effDx, effDy := decodedInput.Dx, decodedInput.Dy
	prevBtnALevel, prevBtnBLevel := int32(0), int32(0)
	if nil != delayedInputListForPrevRdf {
		prevDecodedInput := decodeInput(delayedInputListForPrevRdf[joinIndex-1])
		prevBtnALevel = prevDecodedInput.BtnALevel
		prevBtnBLevel = prevDecodedInput.BtnBLevel
	}

	if decodedInput.BtnBLevel > prevBtnBLevel {
		characStateAlreadyInAir := false
		if ATK_CHARACTER_STATE_INAIR_IDLE1 == currPlayerDownsync.CharacterState || ATK_CHARACTER_STATE_INAIR_ATK1 == currPlayerDownsync.CharacterState || ATK_CHARACTER_STATE_INAIR_ATKED1 == currPlayerDownsync.CharacterState {
			characStateAlreadyInAir = true
		}
		characStateIsInterruptWaivable := false
		if ATK_CHARACTER_STATE_IDLE1 == currPlayerDownsync.CharacterState || ATK_CHARACTER_STATE_WALKING == currPlayerDownsync.CharacterState || ATK_CHARACTER_STATE_INAIR_IDLE1 == currPlayerDownsync.CharacterState {
			characStateIsInterruptWaivable = true
		}
		if !characStateAlreadyInAir && characStateIsInterruptWaivable {
			jumpedOrNot = true
		}
	}

	patternId := PATTERN_ID_NO_OP
	if decodedInput.BtnALevel > prevBtnALevel {
		patternId = 0
		effDx, effDy = 0, 0 // Most patterns/skills should not allow simultaneous movement
	}

	return patternId, jumpedOrNot, effDx, effDy
}

// [WARNING] The params of this method is carefully tuned such that only "battle.RoomDownsyncFrame" is a necessary custom struct.
func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer *RingBuffer, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, gravityX, gravityY, jumpingInitVelY, inputDelayFrames int32, inputScaleFrames uint32, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio float64, playerOpPatternToSkillId map[int]int) *RoomDownsyncFrame {
	// [WARNING] On backend this function MUST BE called while "InputsBufferLock" is locked!
	roomCapacity := len(currRenderFrame.PlayersArr)
	nextRenderFramePlayers := make([]*PlayerDownsync, roomCapacity)
	// Make a copy first
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		nextRenderFramePlayers[i] = &PlayerDownsync{
			Id:              currPlayerDownsync.Id,
			VirtualGridX:    currPlayerDownsync.VirtualGridX,
			VirtualGridY:    currPlayerDownsync.VirtualGridY,
			DirX:            currPlayerDownsync.DirX,
			DirY:            currPlayerDownsync.DirY,
			VelX:            currPlayerDownsync.VelX,
			VelY:            currPlayerDownsync.VelY,
			CharacterState:  currPlayerDownsync.CharacterState,
			InAir:           true,
			Speed:           currPlayerDownsync.Speed,
			BattleState:     currPlayerDownsync.BattleState,
			Score:           currPlayerDownsync.Score,
			Removed:         currPlayerDownsync.Removed,
			JoinIndex:       currPlayerDownsync.JoinIndex,
			FramesToRecover: currPlayerDownsync.FramesToRecover - 1,
			Hp:              currPlayerDownsync.Hp,
			MaxHp:           currPlayerDownsync.MaxHp,
		}
		if nextRenderFramePlayers[i].FramesToRecover < 0 {
			nextRenderFramePlayers[i].FramesToRecover = 0
		}
	}

	nextRenderFrameMeleeBullets := make([]*MeleeBullet, 0, len(currRenderFrame.MeleeBullets)) // Is there any better way to reduce malloc/free impact, e.g. smart prediction for fixed memory allocation?
	effPushbacks := make([]Vec2D, roomCapacity)
	hardPushbackNorms := make([]*[]Vec2D, roomCapacity)

	// 1. Process player inputs
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		patternId, jumpedOrNot, effDx, effDy := deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame, currRenderFrame, inputsBuffer, inputDelayFrames, inputScaleFrames)
		if PATTERN_ID_UNABLE_TO_OP == patternId {
			continue
		}

		if jumpedOrNot {
			thatPlayerInNextFrame.VelY = jumpingInitVelY
			thatPlayerInNextFrame.VirtualGridY += jumpingInitVelY // Immediately gets out of any snapping
		}
		joinIndex := currPlayerDownsync.JoinIndex
		if PATTERN_ID_NO_OP != patternId {
			if skillId, existent := playerOpPatternToSkillId[(int(joinIndex)<<uint(8))+patternId]; existent {
				skillConfig := skillIdToBullet[skillId].(*MeleeBullet) // Hardcoded type "MeleeBullet" for now
				var newMeleeBullet MeleeBullet = *skillConfig
				newMeleeBullet.OffenderJoinIndex = joinIndex
				newMeleeBullet.OffenderPlayerId = currPlayerDownsync.Id
				newMeleeBullet.OriginatedRenderFrameId = currRenderFrame.Id
				nextRenderFrameMeleeBullets = append(nextRenderFrameMeleeBullets, &newMeleeBullet)
				thatPlayerInNextFrame.FramesToRecover = newMeleeBullet.RecoveryFrames
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ATK1
				if false == currPlayerDownsync.InAir {
					thatPlayerInNextFrame.VelX = 0
				}
			}
			continue
		}

		if 0 != effDx || 0 != effDy {
			thatPlayerInNextFrame.DirX, thatPlayerInNextFrame.DirY = effDx, effDy
			thatPlayerInNextFrame.VelX = effDx * currPlayerDownsync.Speed
			thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_WALKING
		} else {
			thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
			thatPlayerInNextFrame.VelX = 0
		}
	}

	// 2. Process player movement
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y = float64(0), float64(0)
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		// Reset playerCollider position from the "virtual grid position"
		newVx, newVy := currPlayerDownsync.VirtualGridX+currPlayerDownsync.VelX, currPlayerDownsync.VirtualGridY+currPlayerDownsync.VelY

		playerCollider.X, playerCollider.Y = VirtualGridToPolygonColliderBLPos(newVx, newVy, playerCollider.W*0.5, playerCollider.H*0.5, 0, 0, 0, 0, collisionSpaceOffsetX, collisionSpaceOffsetY, virtualGridToWorldRatio)
		// Update in the collision system
		playerCollider.Update()

		if currPlayerDownsync.InAir {
			thatPlayerInNextFrame.VelX += gravityX
			thatPlayerInNextFrame.VelY += gravityY
		}
	}

	// 3. Add bullet colliders into collision system
	bulletColliders := make([]*resolv.Object, 0, len(currRenderFrame.MeleeBullets)) // Will all be removed at the end of this function due to the need for being rollback-compatible
	for _, meleeBullet := range currRenderFrame.MeleeBullets {
		if (meleeBullet.OriginatedRenderFrameId+meleeBullet.StartupFrames <= currRenderFrame.Id) && (meleeBullet.OriginatedRenderFrameId+meleeBullet.StartupFrames+meleeBullet.ActiveFrames > currRenderFrame.Id) {
			offender := currRenderFrame.PlayersArr[meleeBullet.OffenderJoinIndex-1]

			xfac := float64(1.0) // By now, straight Punch offset doesn't respect "y-axis"
			if 0 > offender.DirX {
				xfac = float64(-1.0)
			}
			offenderWx, offenderWy := VirtualGridToWorldPos(offender.VirtualGridX, offender.VirtualGridY, virtualGridToWorldRatio)
			bulletWx, bulletWy := offenderWx+xfac*meleeBullet.HitboxOffset, offenderWy
			newBulletCollider := GenerateRectCollider(bulletWx, bulletWy, meleeBullet.HitboxSizeX, meleeBullet.HitboxSizeY, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, collisionSpaceOffsetX, collisionSpaceOffsetY, meleeBullet, "MeleeBullet")
			collisionSys.Add(newBulletCollider)
			bulletColliders = append(bulletColliders, newBulletCollider)
		} else {
			nextRenderFrameMeleeBullets = append(nextRenderFrameMeleeBullets, meleeBullet)
		}
	}

	// 4. Calc pushbacks for each player (after its movement) w/o bullets
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
		hardPushbackNorms[joinIndex-1] = calcHardPushbacksNorms(joinIndex, playerCollider, playerShape, snapIntoPlatformOverlap, &(effPushbacks[joinIndex-1]))
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		landedOnGravityPushback := false
		if collision := playerCollider.Check(0, 0); nil != collision {
			for _, obj := range collision.Objects {
				isBarrier, isAnotherPlayer, isBullet := false, false, false
				switch obj.Data.(type) {
				case *PlayerDownsync:
					isAnotherPlayer = true
				case *MeleeBullet:
					isBullet = true
				default:
					// By default it's a regular barrier, even if data is nil
					isBarrier = true
				}
				if isBullet {
					// ignore bullets for this step
					continue
				}
				bShape := obj.Shape.(*resolv.ConvexPolygon)
				overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(0, 0, playerShape, bShape)
				if !overlapped {
					continue
				}
				normAlignmentWithGravity := (overlapResult.OverlapX*float64(0) + overlapResult.OverlapY*float64(-1.0))
				if isAnotherPlayer {
					// [WARNING] The "zero overlap collision" might be randomly detected/missed on either frontend or backend, to have deterministic result we added paddings to all sides of a playerCollider. As each velocity component of (velX, velY) being a multiple of 0.5 at any renderFrame, each position component of (x, y) can only be a multiple of 0.5 too, thus whenever a 1-dimensional collision happens between players from [player#1: i*0.5, player#2: j*0.5, not collided yet] to [player#1: (i+k)*0.5, player#2: j*0.5, collided], the overlap becomes (i+k-j)*0.5+2*s, and after snapping subtraction the effPushback magnitude for each player is (i+k-j)*0.5, resulting in 0.5-multiples-position for the next renderFrame.
					pushbackX, pushbackY = (overlapResult.Overlap-snapIntoPlatformOverlap*2)*overlapResult.OverlapX, (overlapResult.Overlap-snapIntoPlatformOverlap*2)*overlapResult.OverlapY
				}
				for _, hardPushbackNorm := range *hardPushbackNorms[joinIndex-1] {
					projectedMagnitude := pushbackX*hardPushbackNorm.X + pushbackY*hardPushbackNorm.Y
					if isBarrier || (isAnotherPlayer && 0 > projectedMagnitude) {
						pushbackX -= projectedMagnitude * hardPushbackNorm.X
						pushbackY -= projectedMagnitude * hardPushbackNorm.Y
					}
				}
				effPushbacks[joinIndex-1].X += pushbackX
				effPushbacks[joinIndex-1].Y += pushbackY

				if snapIntoPlatformThreshold < normAlignmentWithGravity {
					landedOnGravityPushback = true
					//playerColliderCenterX, playerColliderCenterY := playerCollider.Center()
					//fmt.Printf("joinIndex=%d landedOnGravityPushback\n{renderFrame.id: %d, isBarrier: %v, isAnotherPlayer: %v}\nhardPushbackNormsOfThisPlayer=%v, playerColliderPos=(%.2f,%.2f), immediatePushback={%.3f, %.3f}, effPushback={%.3f, %.3f}, overlapMag=%.4f\n", joinIndex, currRenderFrame.Id, isBarrier, isAnotherPlayer, *hardPushbackNorms[joinIndex-1], playerColliderCenterX, playerColliderCenterY, pushbackX, pushbackY, effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y, overlapResult.Overlap)
				}
			}
		}
		if landedOnGravityPushback {
			thatPlayerInNextFrame.InAir = false
			if currPlayerDownsync.InAir && 0 > currPlayerDownsync.VelY {
				// fallStopping
				thatPlayerInNextFrame.VelX = 0
				thatPlayerInNextFrame.VelY = 0
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
				thatPlayerInNextFrame.FramesToRecover = 0
			}
		}
		if currPlayerDownsync.InAir {
			oldNextCharacterState := thatPlayerInNextFrame.CharacterState
			switch oldNextCharacterState {
			case ATK_CHARACTER_STATE_IDLE1, ATK_CHARACTER_STATE_WALKING:
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_IDLE1
			case ATK_CHARACTER_STATE_ATK1:
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_ATK1
			case ATK_CHARACTER_STATE_ATKED1:
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_ATKED1
			}
		}
	}

	// 5. Check bullet-anything collisions
	for _, bulletCollider := range bulletColliders {
		meleeBullet := bulletCollider.Data.(*MeleeBullet)
		bulletShape := bulletCollider.Shape.(*resolv.ConvexPolygon)
		collision := bulletCollider.Check(0, 0)
		bulletCollider.Space.Remove(bulletCollider) // Make sure that the bulletCollider is always removed for each renderFrame
		if nil == collision {
			nextRenderFrameMeleeBullets = append(nextRenderFrameMeleeBullets, meleeBullet)
			continue
		}
		offender := currRenderFrame.PlayersArr[meleeBullet.OffenderJoinIndex-1]
		for _, obj := range collision.Objects {
			defenderShape := obj.Shape.(*resolv.ConvexPolygon)
			switch t := obj.Data.(type) {
			case *PlayerDownsync:
				if meleeBullet.OffenderPlayerId == t.Id {
					continue
				}
				overlapped, _, _, _ := CalcPushbacks(0, 0, bulletShape, defenderShape)
				if !overlapped {
					continue
				}
				joinIndex := t.JoinIndex
				xfac := float64(1.0) // By now, straight Punch offset doesn't respect "y-axis"
				if 0 > offender.DirX {
					xfac = float64(-1.0)
				}
				pushbackX, pushbackY := -xfac*meleeBullet.Pushback, float64(0)

				for _, hardPushbackNorm := range *hardPushbackNorms[joinIndex-1] {
					projectedMagnitude := pushbackX*hardPushbackNorm.X + pushbackY*hardPushbackNorm.Y
					if 0 > projectedMagnitude {
						//fmt.Printf("defenderPlayerId=%d, joinIndex=%d reducing bullet pushback={%.3f, %.3f} by {%.3f, %.3f} where hardPushbackNorm={%.3f, %.3f}, projectedMagnitude=%.3f at renderFrame.id=%d", t.Id, joinIndex, pushbackX, pushbackY, projectedMagnitude*hardPushbackNorm.X, projectedMagnitude*hardPushbackNorm.Y, hardPushbackNorm.X, hardPushbackNorm.Y, projectedMagnitude, currRenderFrame.Id)
						pushbackX -= projectedMagnitude * hardPushbackNorm.X
						pushbackY -= projectedMagnitude * hardPushbackNorm.Y
					}
				}

				effPushbacks[joinIndex-1].X += pushbackX
				effPushbacks[joinIndex-1].Y += pushbackY
				atkedPlayerInCurFrame, atkedPlayerInNextFrame := currRenderFrame.PlayersArr[t.JoinIndex-1], nextRenderFramePlayers[t.JoinIndex-1]
				atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ATKED1
				if atkedPlayerInCurFrame.InAir {
					atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_ATKED1
				}
				oldFramesToRecover := nextRenderFramePlayers[t.JoinIndex-1].FramesToRecover
				if meleeBullet.HitStunFrames > oldFramesToRecover {
					atkedPlayerInNextFrame.FramesToRecover = meleeBullet.HitStunFrames
				}
			default:
			}
		}
	}

	// 6. Get players out of stuck barriers if there's any
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		// Update "virtual grid position"
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		thatPlayerInNextFrame.VirtualGridX, thatPlayerInNextFrame.VirtualGridY = PolygonColliderBLToVirtualGridPos(playerCollider.X-effPushbacks[joinIndex-1].X, playerCollider.Y-effPushbacks[joinIndex-1].Y, playerCollider.W*0.5, playerCollider.H*0.5, 0, 0, 0, 0, collisionSpaceOffsetX, collisionSpaceOffsetY, worldToVirtualGridRatio)
	}

	return &RoomDownsyncFrame{
		Id:           currRenderFrame.Id + 1,
		PlayersArr:   nextRenderFramePlayers,
		MeleeBullets: nextRenderFrameMeleeBullets,
	}
}

func GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *resolv.Object {
	blX, blY := WorldToPolygonColliderBLPos(wx, wy, w*0.5, h*0.5, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY)
	return generateRectColliderInCollisionSpace(blX, blY, leftPadding+w+rightPadding, bottomPadding+h+topPadding, data, tag)
}

func generateRectColliderInCollisionSpace(blX, blY, w, h float64, data interface{}, tag string) *resolv.Object {
	collider := resolv.NewObject(blX, blY, w, h, tag) // Unlike its frontend counter part, the position of a "resolv.Object" must be specified by "bottom-left point" because "w" and "h" must be positive, see "resolv.Object.BoundsToSpace" for details
	shape := resolv.NewRectangle(0, 0, w, h)
	collider.SetShape(shape)
	collider.Data = data
	return collider
}

func GenerateConvexPolygonCollider(unalignedSrc *Polygon2D, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *resolv.Object {
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
	collider.Data = data

	return collider
}

func AlignPolygon2DToBoundingBox(input *Polygon2D) *Polygon2D {
	// Transform again to put "anchor" at the "bottom-left point (w.r.t. world space)" of the bounding box for "resolv"
	boundingBoxBL := &Vec2D{
		X: MAX_FLOAT64,
		Y: MAX_FLOAT64,
	}
	for _, p := range input.Points {
		if p.X < boundingBoxBL.X {
			boundingBoxBL.X = p.X
		}
		if p.Y < boundingBoxBL.Y {
			boundingBoxBL.Y = p.Y
		}
	}

	// Now "input.Anchor" should move to "input.Anchor+boundingBoxBL", thus "boundingBoxBL" is also the value of the negative diff for all "input.Points"
	output := &Polygon2D{
		Anchor: &Vec2D{
			X: input.Anchor.X + boundingBoxBL.X,
			Y: input.Anchor.Y + boundingBoxBL.Y,
		},
		Points: make([]*Vec2D, len(input.Points)),
	}

	for i, p := range input.Points {
		output.Points[i] = &Vec2D{
			X: p.X - boundingBoxBL.X,
			Y: p.Y - boundingBoxBL.Y,
		}
	}

	return output
}
