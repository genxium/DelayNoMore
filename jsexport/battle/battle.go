package battle

import (
	//"fmt"
	"math"
	"resolv"
)

const (
	MAX_FLOAT64                    = 1.7e+308
	MAX_INT32                      = int32(999999999)
	COLLISION_PLAYER_INDEX_PREFIX  = (1 << 17)
	COLLISION_BARRIER_INDEX_PREFIX = (1 << 16)
	COLLISION_BULLET_INDEX_PREFIX  = (1 << 15)

	PATTERN_ID_UNABLE_TO_OP = -2
	PATTERN_ID_NO_OP        = -1

	WORLD_TO_VIRTUAL_GRID_RATIO = float64(100.0)
	VIRTUAL_GRID_TO_WORLD_RATIO = float64(1.0) / WORLD_TO_VIRTUAL_GRID_RATIO

	GRAVITY_X = int32(0)
	GRAVITY_Y = -int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO) // makes all "playerCollider.Y" a multiple of 0.5 in all cases

	INPUT_DELAY_FRAMES = int32(8)  // in the count of render frames
	INPUT_SCALE_FRAMES = uint32(2) // inputDelayedAndScaledFrameId = ((originalFrameId - InputDelayFrames) >> InputScaleFrames)
	NST_DELAY_FRAMES   = int32(16) // network-single-trip delay in the count of render frames, proposed to be (InputDelayFrames >> 1) because we expect a round-trip delay to be exactly "InputDelayFrames"

	SP_ATK_LOOKUP_FRAMES = int32(5)

	SNAP_INTO_PLATFORM_OVERLAP   = float64(0.1)
	SNAP_INTO_PLATFORM_THRESHOLD = float64(0.5)
	VERTICAL_PLATFORM_THRESHOLD  = float64(0.9)

	NO_SKILL     = -1
	NO_SKILL_HIT = -1

	NO_LOCK_VEL = int32(-1)
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

const (
	BULLET_STARTUP   = int32(0)
	BULLET_ACTIVE    = int32(1)
	BULLET_EXPLODING = int32(2)
)

const (
	ATK_CHARACTER_STATE_IDLE1               = int32(0)
	ATK_CHARACTER_STATE_WALKING             = int32(1)
	ATK_CHARACTER_STATE_ATK1                = int32(2)
	ATK_CHARACTER_STATE_ATKED1              = int32(3)
	ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP = int32(4)
	ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP = int32(5)
	ATK_CHARACTER_STATE_INAIR_ATK1          = int32(6)
	ATK_CHARACTER_STATE_INAIR_ATKED1        = int32(7)
	ATK_CHARACTER_STATE_BLOWN_UP1           = int32(8)
	ATK_CHARACTER_STATE_LAY_DOWN1           = int32(9)
	ATK_CHARACTER_STATE_GET_UP1             = int32(10)

	ATK_CHARACTER_STATE_ATK2 = int32(11)
	ATK_CHARACTER_STATE_ATK3 = int32(12)
	ATK_CHARACTER_STATE_ATK4 = int32(13)
	ATK_CHARACTER_STATE_ATK5 = int32(14)

	ATK_CHARACTER_STATE_DASHING = int32(15)
	ATK_CHARACTER_STATE_ONWALL  = int32(16)

	ATK_CHARACTER_STATE_TURNAROUND = int32(17)
)

var inAirSet = map[int32]bool{
	ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP: true,
	ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP: true,
	ATK_CHARACTER_STATE_INAIR_ATK1:          true,
	ATK_CHARACTER_STATE_INAIR_ATKED1:        true,
	ATK_CHARACTER_STATE_BLOWN_UP1:           true,
	ATK_CHARACTER_STATE_ONWALL:              true,
}

var noOpSet = map[int32]bool{
	ATK_CHARACTER_STATE_ATKED1:       true,
	ATK_CHARACTER_STATE_INAIR_ATKED1: true,
	ATK_CHARACTER_STATE_BLOWN_UP1:    true,
	ATK_CHARACTER_STATE_LAY_DOWN1:    true,
	// During the invinsible frames of GET_UP1, the player is allowed to take any action
}

var invinsibleSet = map[int32]bool{
	ATK_CHARACTER_STATE_BLOWN_UP1: true,
	ATK_CHARACTER_STATE_LAY_DOWN1: true,
	ATK_CHARACTER_STATE_GET_UP1:   true,
}

var nonAttackingSet = map[int32]bool{
	ATK_CHARACTER_STATE_IDLE1:               true,
	ATK_CHARACTER_STATE_WALKING:             true,
	ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP: true,
	ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP: true,
	ATK_CHARACTER_STATE_ATKED1:              true,
	ATK_CHARACTER_STATE_INAIR_ATKED1:        true,
	ATK_CHARACTER_STATE_BLOWN_UP1:           true,
	ATK_CHARACTER_STATE_LAY_DOWN1:           true,
	ATK_CHARACTER_STATE_GET_UP1:             true,
}

func intAbs(x int32) int32 {
	if x < 0 {
		return -x
	}
	return x
}

func ShouldPrefabInputFrameDownsync(prevRenderFrameId int32, renderFrameId int32) (bool, int32) {
	for i := prevRenderFrameId + 1; i <= renderFrameId; i++ {
		if (0 <= i) && (0 == (i & ((1 << INPUT_SCALE_FRAMES) - 1))) {
			return true, i
		}
	}
	return false, -1
}

func ShouldGenerateInputFrameUpsync(renderFrameId int32) bool {
	return ((renderFrameId & ((1 << INPUT_SCALE_FRAMES) - 1)) == 0)
}

func ConvertToDelayedInputFrameId(renderFrameId int32) int32 {
	if renderFrameId < INPUT_DELAY_FRAMES {
		return 0
	}
	return ((renderFrameId - INPUT_DELAY_FRAMES) >> INPUT_SCALE_FRAMES)
}

func ConvertToNoDelayInputFrameId(renderFrameId int32) int32 {
	return (renderFrameId >> INPUT_SCALE_FRAMES)
}

func ConvertToFirstUsedRenderFrameId(inputFrameId int32) int32 {
	return ((inputFrameId << INPUT_SCALE_FRAMES) + INPUT_DELAY_FRAMES)
}

func ConvertToLastUsedRenderFrameId(inputFrameId int32) int32 {
	return ((inputFrameId << INPUT_SCALE_FRAMES) + INPUT_DELAY_FRAMES + (1 << INPUT_SCALE_FRAMES) - 1)
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

func calcPushbacks(oldDx, oldDy float64, playerShape, barrierShape *resolv.ConvexPolygon) (bool, float64, float64, *SatResult) {
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

func IsMeleeBulletActive(meleeBullet *MeleeBullet, currRenderFrame *RoomDownsyncFrame) bool {
	if BULLET_EXPLODING == meleeBullet.BlState {
		return false
	}
	return (meleeBullet.BattleAttr.OriginatedRenderFrameId+meleeBullet.Bullet.StartupFrames <= currRenderFrame.Id) && (meleeBullet.BattleAttr.OriginatedRenderFrameId+meleeBullet.Bullet.StartupFrames+meleeBullet.Bullet.ActiveFrames > currRenderFrame.Id)
}

func IsMeleeBulletAlive(meleeBullet *MeleeBullet, currRenderFrame *RoomDownsyncFrame) bool {
	if BULLET_EXPLODING == meleeBullet.BlState {
		return meleeBullet.FramesInBlState < meleeBullet.Bullet.ExplosionFrames
	}
	return (meleeBullet.BattleAttr.OriginatedRenderFrameId+meleeBullet.Bullet.StartupFrames+meleeBullet.Bullet.ActiveFrames > currRenderFrame.Id)
}

func IsFireballBulletActive(fireballBullet *FireballBullet, currRenderFrame *RoomDownsyncFrame) bool {
	if BULLET_EXPLODING == fireballBullet.BlState {
		return false
	}
	return (fireballBullet.BattleAttr.OriginatedRenderFrameId+fireballBullet.Bullet.StartupFrames < currRenderFrame.Id) && (fireballBullet.BattleAttr.OriginatedRenderFrameId+fireballBullet.Bullet.StartupFrames+fireballBullet.Bullet.ActiveFrames > currRenderFrame.Id)
}

func IsFireballBulletAlive(fireballBullet *FireballBullet, currRenderFrame *RoomDownsyncFrame) bool {
	if BULLET_EXPLODING == fireballBullet.BlState {
		return fireballBullet.FramesInBlState < fireballBullet.Bullet.ExplosionFrames
	}
	return (fireballBullet.BattleAttr.OriginatedRenderFrameId+fireballBullet.Bullet.StartupFrames+fireballBullet.Bullet.ActiveFrames > currRenderFrame.Id)
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

func WorldToVirtualGridPos(wx, wy float64) (int32, int32) {
	// [WARNING] Introduces loss of precision!
	// In JavaScript floating numbers suffer from seemingly non-deterministic arithmetics, and even if certain libs solved this issue by approaches such as fixed-point-number, they might not be used in other libs -- e.g. the "collision libs" we're interested in -- thus couldn't kill all pains.
	var virtualGridX int32 = int32(math.Round(wx * WORLD_TO_VIRTUAL_GRID_RATIO))
	var virtualGridY int32 = int32(math.Round(wy * WORLD_TO_VIRTUAL_GRID_RATIO))
	return virtualGridX, virtualGridY
}

func VirtualGridToWorldPos(vx, vy int32) (float64, float64) {
	// No loss of precision
	var wx float64 = float64(vx) * VIRTUAL_GRID_TO_WORLD_RATIO
	var wy float64 = float64(vy) * VIRTUAL_GRID_TO_WORLD_RATIO
	return wx, wy
}

func WorldToPolygonColliderBLPos(wx, wy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (float64, float64) {
	return wx - halfBoundingW - leftPadding + collisionSpaceOffsetX, wy - halfBoundingH - bottomPadding + collisionSpaceOffsetY
}

func PolygonColliderBLToWorldPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (float64, float64) {
	return cx + halfBoundingW + leftPadding - collisionSpaceOffsetX, cy + halfBoundingH + bottomPadding - collisionSpaceOffsetY
}

func PolygonColliderBLToVirtualGridPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (int32, int32) {
	wx, wy := PolygonColliderBLToWorldPos(cx, cy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY)
	return WorldToVirtualGridPos(wx, wy)
}

func VirtualGridToPolygonColliderBLPos(vx, vy int32, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY float64) (float64, float64) {
	wx, wy := VirtualGridToWorldPos(vx, vy)
	return WorldToPolygonColliderBLPos(wx, wy, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY)
}

func calcHardPushbacksNorms(joinIndex int32, currPlayerDownsync, thatPlayerInNextFrame *PlayerDownsync, playerCollider *resolv.Object, playerShape *resolv.ConvexPolygon, snapIntoPlatformOverlap float64, pEffPushback *Vec2D) *[]Vec2D {
	ret := make([]Vec2D, 0, 10) // no one would simultaneously have more than 5 hardPushbacks
	virtualGripToWall := float64(0)
	if ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState && 0 == thatPlayerInNextFrame.VelX && currPlayerDownsync.DirX == thatPlayerInNextFrame.DirX {
		/*
		   I'm not sure whether this is a bug of "resolv_tailored" (maybe due to my changes), on the x-axis a playerCollider whose right edge reaches "1680.1" is not deemed collided with a side wall whose left edge is "1680.0", while the same extent of intersection is OK in y-axis.

		   The workaround here is to grant a "virtualGripToWall" in x-axis to guarantee that if
		   - "currPlayerDownsync" is on wall, and
		   - "thatPlayerInNextFrame.VelX" is 0 (i.e. no proactive move against the wall), and
		   - there's no change in player facing direction
		*/
		xfac := float64(1)
		if 0 > thatPlayerInNextFrame.DirX {
			xfac = -xfac
		}
		virtualGripToWall = xfac * float64(currPlayerDownsync.Speed) * VIRTUAL_GRID_TO_WORLD_RATIO
	}
	collision := playerCollider.Check(virtualGripToWall, 0)
	if nil == collision {
		return &ret
	}

	//playerColliderCenterX, playerColliderCenterY := playerCollider.Center()
	//fmt.Printf("joinIndex=%d calcHardPushbacksNorms has non-empty collision;playerColliderPos=(%.2f,%.2f)\n", joinIndex, playerColliderCenterX, playerColliderCenterY)
	for _, obj := range collision.Objects {
		isBarrier := false
		switch obj.Data.(type) {
		case *PlayerDownsync, *MeleeBullet, *FireballBullet:
		default:
			// By default it's a regular barrier, even if data is nil, note that Golang syntax of switch-case is kind of confusing, this "default" condition is met only if "!*PlayerDownsync && !*MeleeBullet && !*FireballBullet".
			isBarrier = true
		}

		if !isBarrier {
			continue
		}
		barrierShape := obj.Shape.(*resolv.ConvexPolygon)
		overlapped, pushbackX, pushbackY, overlapResult := calcPushbacks(0, 0, playerShape, barrierShape)
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

func deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame *PlayerDownsync, currRenderFrame *RoomDownsyncFrame, chConfig *CharacterConfig, inputsBuffer *RingBuffer) (int, bool, int32, int32) {
	// returns (patternId, jumpedOrNot, effectiveDx, effectiveDy)
	delayedInputFrameId := ConvertToDelayedInputFrameId(currRenderFrame.Id)
	delayedInputFrameIdForPrevRdf := ConvertToDelayedInputFrameId(currRenderFrame.Id - 1)

	if 0 >= delayedInputFrameId {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}

	if _, existent := noOpSet[currPlayerDownsync.CharacterState]; existent {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}

	delayedInputList := inputsBuffer.GetByFrameId(delayedInputFrameId).(*InputFrameDownsync).InputList
	var delayedInputListForPrevRdf []uint64 = nil
	if 0 < delayedInputFrameIdForPrevRdf {
		delayedInputListForPrevRdf = inputsBuffer.GetByFrameId(delayedInputFrameIdForPrevRdf).(*InputFrameDownsync).InputList
	}

	jumpedOrNot := false
	joinIndex := currPlayerDownsync.JoinIndex
	decodedInput := decodeInput(delayedInputList[joinIndex-1])
	effDx, effDy := int32(0), int32(0)
	prevBtnALevel, prevBtnBLevel := int32(0), int32(0)
	if nil != delayedInputListForPrevRdf {
		prevDecodedInput := decodeInput(delayedInputListForPrevRdf[joinIndex-1])
		prevBtnALevel = prevDecodedInput.BtnALevel
		prevBtnBLevel = prevDecodedInput.BtnBLevel
	}

	patternId := PATTERN_ID_NO_OP
	if 0 == currPlayerDownsync.FramesToRecover || currPlayerDownsync.CapturedByInertia {
		// Jumping is allowed within "CapturedByInertia", but moving is only allowed when "0 == FramesToRecover" (constrained later in "ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame")
		effDx, effDy = decodedInput.Dx, decodedInput.Dy
		if decodedInput.BtnBLevel > prevBtnBLevel {
			if chConfig.DashingEnabled && 0 > effDy {
				patternId = 5
			} else if _, existent := inAirSet[currPlayerDownsync.CharacterState]; !existent {
				jumpedOrNot = true
			} else if ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState {
				jumpedOrNot = true
			}
		}
	}

	if PATTERN_ID_NO_OP == patternId {
		if 0 < decodedInput.BtnALevel {
			if decodedInput.BtnALevel > prevBtnALevel {
				if 0 > effDy {
					patternId = 3
				} else if 0 < effDy {
					patternId = 2
				} else {
					patternId = 1
				}
			} else {
				patternId = 4 // Holding
			}
		}
	}

	return patternId, jumpedOrNot, effDx, effDy
}

// [WARNING] The params of this method is carefully tuned such that only "battle.RoomDownsyncFrame" is a necessary custom struct.
func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer *RingBuffer, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, collisionSpaceOffsetX, collisionSpaceOffsetY float64, chConfigsOrderedByJoinIndex []*CharacterConfig) *RoomDownsyncFrame {
	// [WARNING] On backend this function MUST BE called while "InputsBufferLock" is locked!
	roomCapacity := len(currRenderFrame.PlayersArr)
	nextRenderFramePlayers := make([]*PlayerDownsync, roomCapacity)
	// Make a copy first
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		nextRenderFramePlayers[i] = &PlayerDownsync{
			Id:                currPlayerDownsync.Id,
			VirtualGridX:      currPlayerDownsync.VirtualGridX,
			VirtualGridY:      currPlayerDownsync.VirtualGridY,
			DirX:              currPlayerDownsync.DirX,
			DirY:              currPlayerDownsync.DirY,
			VelX:              currPlayerDownsync.VelX,
			VelY:              currPlayerDownsync.VelY,
			CharacterState:    currPlayerDownsync.CharacterState,
			InAir:             true,
			OnWall:            false,
			Speed:             currPlayerDownsync.Speed,
			BattleState:       currPlayerDownsync.BattleState,
			Score:             currPlayerDownsync.Score,
			Removed:           currPlayerDownsync.Removed,
			JoinIndex:         currPlayerDownsync.JoinIndex,
			Hp:                currPlayerDownsync.Hp,
			MaxHp:             currPlayerDownsync.MaxHp,
			FramesToRecover:   currPlayerDownsync.FramesToRecover - 1,
			FramesInChState:   currPlayerDownsync.FramesInChState + 1,
			ActiveSkillId:     currPlayerDownsync.ActiveSkillId,
			ActiveSkillHit:    currPlayerDownsync.ActiveSkillHit,
			FramesInvinsible:  currPlayerDownsync.FramesInvinsible - 1,
			ColliderRadius:    currPlayerDownsync.ColliderRadius,
			OnWallNormX:       currPlayerDownsync.OnWallNormX,
			OnWallNormY:       currPlayerDownsync.OnWallNormY,
			CapturedByInertia: currPlayerDownsync.CapturedByInertia,
		}
		if nextRenderFramePlayers[i].FramesToRecover < 0 {
			nextRenderFramePlayers[i].FramesToRecover = 0
		}
		if nextRenderFramePlayers[i].FramesInvinsible < 0 {
			nextRenderFramePlayers[i].FramesInvinsible = 0
		}
	}

	nextRenderFrameMeleeBullets := make([]*MeleeBullet, 0, len(currRenderFrame.MeleeBullets)) // Is there any better way to reduce malloc/free impact, e.g. smart prediction for fixed memory allocation?
	nextRenderFrameFireballBullets := make([]*FireballBullet, 0, len(currRenderFrame.FireballBullets))
	effPushbacks := make([]Vec2D, roomCapacity)
	hardPushbackNorms := make([]*[]Vec2D, roomCapacity)
	jumpedOrNotList := make([]bool, roomCapacity)

	bulletLocalId := currRenderFrame.BulletLocalIdCounter
	// 1. Process player inputs
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		chConfig := chConfigsOrderedByJoinIndex[i]
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		patternId, jumpedOrNot, effDx, effDy := deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame, currRenderFrame, chConfig, inputsBuffer)

		jumpedOrNotList[i] = jumpedOrNot
		joinIndex := currPlayerDownsync.JoinIndex
		skillId := chConfig.SkillMapper(patternId, currPlayerDownsync)
		if skillConfig, existent := skills[skillId]; existent {
			thatPlayerInNextFrame.ActiveSkillId = int32(skillId)
			thatPlayerInNextFrame.ActiveSkillHit = 0
			thatPlayerInNextFrame.FramesToRecover = skillConfig.RecoveryFrames
			xfac := int32(1)
			if 0 > thatPlayerInNextFrame.DirX {
				xfac = -xfac
			}
			hasLockVel := false

			// Hardcoded to use only the first hit for now
			switch v := skillConfig.Hits[thatPlayerInNextFrame.ActiveSkillHit].(type) {
			case *MeleeBullet:
				var newBullet MeleeBullet = *v // Copied primitive fields into an onstack variable
				newBullet.BattleAttr = &BulletBattleAttr{
					BulletLocalId:           bulletLocalId,
					OriginatedRenderFrameId: currRenderFrame.Id,
					OffenderJoinIndex:       joinIndex,
					TeamId:                  currPlayerDownsync.BulletTeamId,
				}
				bulletLocalId++
				newBullet.BlState = BULLET_STARTUP
				nextRenderFrameMeleeBullets = append(nextRenderFrameMeleeBullets, &newBullet)
				if NO_LOCK_VEL != v.Bullet.SelfLockVelX {
					hasLockVel = true
					thatPlayerInNextFrame.VelX = xfac * v.Bullet.SelfLockVelX
				}
				if NO_LOCK_VEL != v.Bullet.SelfLockVelY {
					hasLockVel = true
					thatPlayerInNextFrame.VelY = v.Bullet.SelfLockVelY
				}
			case *FireballBullet:
				var newBullet FireballBullet = *v // Copied primitive fields into an onstack variable
				newBullet.BattleAttr = &BulletBattleAttr{
					BulletLocalId:           bulletLocalId,
					OriginatedRenderFrameId: currRenderFrame.Id,
					OffenderJoinIndex:       joinIndex,
					TeamId:                  currPlayerDownsync.BulletTeamId,
				}
				bulletLocalId++
				newBullet.VirtualGridX, newBullet.VirtualGridY = currPlayerDownsync.VirtualGridX+xfac*newBullet.Bullet.HitboxOffsetX, currPlayerDownsync.VirtualGridY+newBullet.Bullet.HitboxOffsetY
				newBullet.DirX = xfac
				newBullet.DirY = 0
				newBullet.VelX = newBullet.Speed * xfac
				newBullet.VelY = 0

				newBullet.BlState = BULLET_STARTUP
				nextRenderFrameFireballBullets = append(nextRenderFrameFireballBullets, &newBullet)
				//fmt.Printf("Created new fireball @currRenderFrame.Id=%d, %p, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, offenderVpos=(%d,%d)\n", currRenderFrame.Id, &newBullet, bulletLocalId, newBullet.VirtualGridX, newBullet.VirtualGridY, currPlayerDownsync.VirtualGridX, currPlayerDownsync.VirtualGridY)
				if NO_LOCK_VEL != v.Bullet.SelfLockVelX {
					hasLockVel = true
					thatPlayerInNextFrame.VelX = xfac * v.Bullet.SelfLockVelX
				}
				if NO_LOCK_VEL != v.Bullet.SelfLockVelY {
					hasLockVel = true
					thatPlayerInNextFrame.VelY = v.Bullet.SelfLockVelY
				}
			}

			if false == hasLockVel && false == currPlayerDownsync.InAir {
				thatPlayerInNextFrame.VelX = 0
			}
			thatPlayerInNextFrame.CharacterState = skillConfig.BoundChState
			continue // Don't allow movement if skill is used
		}

		if 0 == currPlayerDownsync.FramesToRecover {
			prevCapturedByInertia := currPlayerDownsync.CapturedByInertia
			isWallJumping := (currPlayerDownsync.Speed < intAbs(currPlayerDownsync.VelX))
			/*
			   if isWallJumping {
			       fmt.Printf("joinIndex=%d is wall jumping\n{renderFrame.id: %d, currPlayerDownsync.Speed: %d, currPlayerDownsync.VelX: %d}\n", currPlayerDownsync.JoinIndex, currRenderFrame.Id, currPlayerDownsync.Speed, currPlayerDownsync.VelX)
			   }
			*/
			alignedWithInertia := true
			exactTurningAround := false
			if 0 == effDx && 0 != thatPlayerInNextFrame.VelX {
				alignedWithInertia = false
			} else if 0 != effDx && 0 == thatPlayerInNextFrame.VelX {
				alignedWithInertia = false
			} else if 0 > effDx*thatPlayerInNextFrame.VelX {
				alignedWithInertia = false
				exactTurningAround = true
			}

			if !jumpedOrNot && !isWallJumping && !prevCapturedByInertia && !alignedWithInertia {
				/*
				   [WARNING] A "turn-around", or in more generic direction schema a "change in direction" is a hurdle for our current "prediction+rollback" approach, yet applying a "FramesToRecover" for "turn-around" can alleviate the graphical inconsistence to a huge extent! For better operational experience, this is intentionally NOT APPLIED TO WALL JUMPING!

				   When "false == alignedWithInertia", we're GUARANTEED TO BE WRONG AT INPUT PREDICTION ON THE FRONTEND, but we COULD STILL BE RIGHT AT POSITION PREDICTION WITHIN "InertiaFramesToRecover" -- which together with "INPUT_DELAY_FRAMES" grants the frontend a big chance to be graphically consistent even upon wrong prediction!
				*/
				//fmt.Printf("joinIndex=%d is not wall jumping and not aligned w/ inertia\n{renderFrame.id: %d, effDx: %d, thatPlayerInNextFrame.VelX: %d}\n", currPlayerDownsync.JoinIndex, currRenderFrame.Id, effDx, thatPlayerInNextFrame.VelX)
				thatPlayerInNextFrame.CapturedByInertia = true
				thatPlayerInNextFrame.FramesToRecover = chConfig.InertiaFramesToRecover
				if exactTurningAround {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_TURNAROUND
				}
			} else {
				thatPlayerInNextFrame.CapturedByInertia = false
				if 0 != effDx {
					xfac := int32(1)
					if 0 > effDx {
						xfac = -xfac
					}
					thatPlayerInNextFrame.DirX = effDx
					thatPlayerInNextFrame.DirY = effDy

					if isWallJumping {
						//fmt.Printf("joinIndex=%d is controlling while wall jumping\n{renderFrame.id: %d, currPlayerDownsync.Speed: %d, currPlayerDownsync.VelX: %d, effDx: %d}\n", currPlayerDownsync.JoinIndex, currRenderFrame.Id, currPlayerDownsync.Speed, currPlayerDownsync.VelX, effDx)
						thatPlayerInNextFrame.VelX = xfac * intAbs(currPlayerDownsync.VelX)
					} else {
						thatPlayerInNextFrame.VelX = xfac * currPlayerDownsync.Speed
					}
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_WALKING
				} else {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
					thatPlayerInNextFrame.VelX = 0
				}
			}

		}
	}

	// 2. Process player movement
	playerColliders := make([]*resolv.Object, len(currRenderFrame.PlayersArr), len(currRenderFrame.PlayersArr)) // Will all be removed at the end of this function due to the need for being rollback-compatible
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y = float64(0), float64(0)
		thatPlayerInNextFrame := nextRenderFramePlayers[i]

		chConfig := chConfigsOrderedByJoinIndex[i]
		// Reset playerCollider position from the "virtual grid position"
		newVx, newVy := currPlayerDownsync.VirtualGridX+currPlayerDownsync.VelX, currPlayerDownsync.VirtualGridY+currPlayerDownsync.VelY
		if jumpedOrNotList[i] {
			// We haven't proceeded with "OnWall" calculation for "thatPlayerInNextFrame", thus use "currPlayerDownsync.OnWall" for checking
			if ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState {
				if 0 < currPlayerDownsync.VelX*currPlayerDownsync.OnWallNormX {
					newVx -= currPlayerDownsync.VelX // Cancel the alleged horizontal movement pointing to same direction of wall inward norm first
				}
				xfac := int32(-1)
				if 0 > currPlayerDownsync.OnWallNormX {
					// Always jump to the opposite direction of wall inward norm
					xfac = -xfac
				}
				newVx += xfac * chConfig.WallJumpingInitVelX
				newVy += chConfig.WallJumpingInitVelY
				thatPlayerInNextFrame.VelX = int32(xfac * chConfig.WallJumpingInitVelX)
				thatPlayerInNextFrame.VelY = int32(chConfig.WallJumpingInitVelY)
				thatPlayerInNextFrame.FramesToRecover = chConfig.WallJumpingFramesToRecover
			} else {
				thatPlayerInNextFrame.VelY = int32(chConfig.JumpingInitVelY)
				newVy += chConfig.JumpingInitVelY // Immediately gets out of any snapping
			}
		}

		wx, wy := VirtualGridToWorldPos(newVx, newVy)
		colliderWidth, colliderHeight := currPlayerDownsync.ColliderRadius*2, currPlayerDownsync.ColliderRadius*4
		switch currPlayerDownsync.CharacterState {
		case ATK_CHARACTER_STATE_LAY_DOWN1:
			colliderWidth, colliderHeight = currPlayerDownsync.ColliderRadius*4, currPlayerDownsync.ColliderRadius*2
		case ATK_CHARACTER_STATE_BLOWN_UP1, ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP, ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP, ATK_CHARACTER_STATE_ONWALL:
			colliderWidth, colliderHeight = currPlayerDownsync.ColliderRadius*2, currPlayerDownsync.ColliderRadius*2
		}

		colliderWorldWidth, colliderWorldHeight := VirtualGridToWorldPos(colliderWidth, colliderHeight)

		playerCollider := GenerateRectCollider(wx, wy, colliderWorldWidth, colliderWorldHeight, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, currPlayerDownsync, "Player") // the coords of all barrier boundaries are multiples of tileWidth(i.e. 16), by adding snapping y-padding when "landedOnGravityPushback" all "playerCollider.Y" would be a multiple of 1.0
		playerColliders[i] = playerCollider

		// Add to collision system
		collisionSys.Add(playerCollider)

		if currPlayerDownsync.InAir {
			if ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState && !jumpedOrNotList[i] {
				thatPlayerInNextFrame.VelX += GRAVITY_X
				thatPlayerInNextFrame.VelY = chConfig.WallSlidingVelY
			} else {
				thatPlayerInNextFrame.VelX += GRAVITY_X
				thatPlayerInNextFrame.VelY += GRAVITY_Y
			}
		}
	}

	// 3. Add bullet colliders into collision system

	// [WARNING] For rollback compatibility, static data of "BulletConfig" & "BattleAttr(static since instantiated)" can just be copies of the pointers in "RenderFrameBuffer", however, FireballBullets movement data as well as bullet animation data must be copies of instances for each RenderFrame!
	bulletColliders := make([]*resolv.Object, 0, len(currRenderFrame.MeleeBullets)) // Will all be removed at the end of this function due to the need for being rollback-compatible
	for _, prevMelee := range currRenderFrame.MeleeBullets {
		meleeBullet := &MeleeBullet{
			Bullet:          prevMelee.Bullet,
			BattleAttr:      prevMelee.BattleAttr,
			FramesInBlState: prevMelee.FramesInBlState + 1,
			BlState:         prevMelee.BlState,
		}
		if IsMeleeBulletAlive(meleeBullet, currRenderFrame) {
			if IsMeleeBulletActive(meleeBullet, currRenderFrame) {
				offender := currRenderFrame.PlayersArr[meleeBullet.BattleAttr.OffenderJoinIndex-1]

				xfac := int32(1) // By now, straight Punch offset doesn't respect "y-axis"
				if 0 > offender.DirX {
					xfac = -xfac
				}
				bulletWx, bulletWy := VirtualGridToWorldPos(offender.VirtualGridX+xfac*meleeBullet.Bullet.HitboxOffsetX, offender.VirtualGridY)
				hitboxSizeWx, hitboxSizeWy := VirtualGridToWorldPos(meleeBullet.Bullet.HitboxSizeX, meleeBullet.Bullet.HitboxSizeY)
				newBulletCollider := GenerateRectCollider(bulletWx, bulletWy, hitboxSizeWx, hitboxSizeWy, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, meleeBullet, "MeleeBullet")
				collisionSys.Add(newBulletCollider)
				bulletColliders = append(bulletColliders, newBulletCollider)
				meleeBullet.BlState = BULLET_ACTIVE
				if meleeBullet.BlState != prevMelee.BlState {
					meleeBullet.FramesInBlState = 0
				}
			}
			nextRenderFrameMeleeBullets = append(nextRenderFrameMeleeBullets, meleeBullet)
		}
	}

	for _, prevFireball := range currRenderFrame.FireballBullets {
		fireballBullet := &FireballBullet{
			VirtualGridX:    prevFireball.VirtualGridX,
			VirtualGridY:    prevFireball.VirtualGridY,
			DirX:            prevFireball.DirX,
			DirY:            prevFireball.DirY,
			VelX:            prevFireball.VelX,
			VelY:            prevFireball.VelY,
			Speed:           prevFireball.Speed,
			Bullet:          prevFireball.Bullet,
			BattleAttr:      prevFireball.BattleAttr,
			FramesInBlState: prevFireball.FramesInBlState + 1,
			BlState:         prevFireball.BlState,
		}
		if IsFireballBulletAlive(fireballBullet, currRenderFrame) {
			if IsFireballBulletActive(fireballBullet, currRenderFrame) {
				bulletWx, bulletWy := VirtualGridToWorldPos(fireballBullet.VirtualGridX, fireballBullet.VirtualGridY)
				hitboxSizeWx, hitboxSizeWy := VirtualGridToWorldPos(fireballBullet.Bullet.HitboxSizeX, fireballBullet.Bullet.HitboxSizeY)
				newBulletCollider := GenerateRectCollider(bulletWx, bulletWy, hitboxSizeWx, hitboxSizeWy, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, fireballBullet, "FireballBullet")
				collisionSys.Add(newBulletCollider)
				bulletColliders = append(bulletColliders, newBulletCollider)
				fireballBullet.BlState = BULLET_ACTIVE
				if fireballBullet.BlState != prevFireball.BlState {
					fireballBullet.FramesInBlState = 0
				}
				fireballBullet.VirtualGridX, fireballBullet.VirtualGridY = fireballBullet.VirtualGridX+fireballBullet.VelX, fireballBullet.VirtualGridY+fireballBullet.VelY
				//fmt.Printf("Pushing active fireball to next frame @currRenderFrame.Id=%d, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, blState=%d\n", currRenderFrame.Id, fireballBullet.BattleAttr.BulletLocalId, fireballBullet.VirtualGridX, fireballBullet.VirtualGridY, fireballBullet.BlState)
			} else {
				//fmt.Printf("Pushing non-active fireball to next frame @currRenderFrame.Id=%d, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, blState=%d\n", currRenderFrame.Id, fireballBullet.BattleAttr.BulletLocalId, fireballBullet.VirtualGridX, fireballBullet.VirtualGridY, fireballBullet.BlState)
			}
			nextRenderFrameFireballBullets = append(nextRenderFrameFireballBullets, fireballBullet)
		}
	}

	// 4. Calc pushbacks for each player (after its movement) w/o bullets
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		playerCollider := playerColliders[i]
		playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		hardPushbackNorms[joinIndex-1] = calcHardPushbacksNorms(joinIndex, currPlayerDownsync, thatPlayerInNextFrame, playerCollider, playerShape, SNAP_INTO_PLATFORM_OVERLAP, &(effPushbacks[joinIndex-1]))
		chConfig := chConfigsOrderedByJoinIndex[i]
		landedOnGravityPushback := false

		if collision := playerCollider.Check(0, 0); nil != collision {
			for _, obj := range collision.Objects {
				isBarrier, isAnotherPlayer, isBullet := false, false, false
				switch obj.Data.(type) {
				case *PlayerDownsync:
					isAnotherPlayer = true
				case *MeleeBullet, *FireballBullet:
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
				overlapped, pushbackX, pushbackY, overlapResult := calcPushbacks(0, 0, playerShape, bShape)
				if !overlapped {
					continue
				}
				normAlignmentWithGravity := (overlapResult.OverlapX*float64(0) + overlapResult.OverlapY*float64(-1.0))
				if isAnotherPlayer {
					// [WARNING] The "zero overlap collision" might be randomly detected/missed on either frontend or backend, to have deterministic result we added paddings to all sides of a playerCollider. As each velocity component of (velX, velY) being a multiple of 0.5 at any renderFrame, each position component of (x, y) can only be a multiple of 0.5 too, thus whenever a 1-dimensional collision happens between players from [player#1: i*0.5, player#2: j*0.5, not collided yet] to [player#1: (i+k)*0.5, player#2: j*0.5, collided], the overlap becomes (i+k-j)*0.5+2*s, and after snapping subtraction the effPushback magnitude for each player is (i+k-j)*0.5, resulting in 0.5-multiples-position for the next renderFrame.
					pushbackX, pushbackY = (overlapResult.Overlap-SNAP_INTO_PLATFORM_OVERLAP*2)*overlapResult.OverlapX, (overlapResult.Overlap-SNAP_INTO_PLATFORM_OVERLAP*2)*overlapResult.OverlapY
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

				if SNAP_INTO_PLATFORM_THRESHOLD < normAlignmentWithGravity {
					landedOnGravityPushback = true
					//playerColliderCenterX, playerColliderCenterY := playerCollider.Center()
					//fmt.Printf("joinIndex=%d landedOnGravityPushback\n{renderFrame.id: %d, isBarrier: %v, isAnotherPlayer: %v}\nhardPushbackNormsOfThisPlayer=%v, playerColliderPos=(%.2f,%.2f), immediatePushback={%.3f, %.3f}, effPushback={%.3f, %.3f}, overlapMag=%.4f\n", joinIndex, currRenderFrame.Id, isBarrier, isAnotherPlayer, *hardPushbackNorms[joinIndex-1], playerColliderCenterX, playerColliderCenterY, pushbackX, pushbackY, effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y, overlapResult.Overlap)
				}
			}
		}
		if landedOnGravityPushback {
			thatPlayerInNextFrame.InAir = false
			fallStopping := (currPlayerDownsync.InAir && 0 >= currPlayerDownsync.VelY)
			if fallStopping {
				thatPlayerInNextFrame.VelY = 0
				thatPlayerInNextFrame.VelX = 0
				if ATK_CHARACTER_STATE_BLOWN_UP1 == thatPlayerInNextFrame.CharacterState {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_LAY_DOWN1
					thatPlayerInNextFrame.FramesToRecover = chConfig.LayDownFramesToRecover
				} else {
					switch currPlayerDownsync.CharacterState {
					case ATK_CHARACTER_STATE_BLOWN_UP1, ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP, ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP, ATK_CHARACTER_STATE_ONWALL:
						// [WARNING] To prevent bouncing due to abrupt change of collider shape, it's important that we check "currPlayerDownsync" instead of "thatPlayerInNextFrame" here!
						halfColliderWidthDiff, halfColliderHeightDiff := int32(0), currPlayerDownsync.ColliderRadius
						_, halfColliderWorldHeightDiff := VirtualGridToWorldPos(halfColliderWidthDiff, halfColliderHeightDiff)
						effPushbacks[joinIndex-1].Y -= halfColliderWorldHeightDiff
					}
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
					thatPlayerInNextFrame.FramesToRecover = 0
				}
			} else {
				// landedOnGravityPushback not fallStopping, could be in LayDown or GetUp
				if _, existent := nonAttackingSet[thatPlayerInNextFrame.CharacterState]; existent {
					if ATK_CHARACTER_STATE_LAY_DOWN1 == thatPlayerInNextFrame.CharacterState {
						if 0 == thatPlayerInNextFrame.FramesToRecover {
							thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_GET_UP1
							thatPlayerInNextFrame.FramesToRecover = chConfig.GetUpFramesToRecover
						}
					} else if ATK_CHARACTER_STATE_GET_UP1 == thatPlayerInNextFrame.CharacterState {
						if 0 == thatPlayerInNextFrame.FramesToRecover {
							thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
							thatPlayerInNextFrame.FramesInvinsible = chConfig.GetUpInvinsibleFrames
						}
					}
				}
			}
		}

		if chConfig.OnWallEnabled {
			if thatPlayerInNextFrame.InAir {
				// [WARNING] Sticking to wall MUST BE based on "InAir", otherwise we would get gravity reduction from ground up incorrectly!
				if _, existent := noOpSet[currPlayerDownsync.CharacterState]; !existent {
					// [WARNING] Sticking to wall could only be triggered by proactive player input
					for _, hardPushbackNorm := range *hardPushbackNorms[joinIndex-1] {
						normAlignmentWithHorizon1 := (hardPushbackNorm.X*float64(1.0) + hardPushbackNorm.Y*float64(0.0))
						normAlignmentWithHorizon2 := (hardPushbackNorm.X*float64(-1.0) + hardPushbackNorm.Y*float64(0.0))
						if VERTICAL_PLATFORM_THRESHOLD < normAlignmentWithHorizon1 {
							thatPlayerInNextFrame.OnWall = true
							thatPlayerInNextFrame.OnWallNormX, thatPlayerInNextFrame.OnWallNormY = int32(hardPushbackNorm.X), int32(hardPushbackNorm.Y)
							break
						}
						if VERTICAL_PLATFORM_THRESHOLD < normAlignmentWithHorizon2 {
							thatPlayerInNextFrame.OnWall = true
							thatPlayerInNextFrame.OnWallNormX, thatPlayerInNextFrame.OnWallNormY = int32(hardPushbackNorm.X), int32(hardPushbackNorm.Y)
							break
						}
					}

					if !currPlayerDownsync.OnWall && thatPlayerInNextFrame.OnWall {
						// To avoid mysterious climbing up the wall after sticking on it
						thatPlayerInNextFrame.VelY = 0
					}
				}
			}
			if !thatPlayerInNextFrame.OnWall {
				thatPlayerInNextFrame.OnWallNormX, thatPlayerInNextFrame.OnWallNormY = 0, 0
			}
		}

	}

	// 5. Check bullet-anything collisions
	for _, bulletCollider := range bulletColliders {
		collision := bulletCollider.Check(0, 0)
		bulletCollider.Space.Remove(bulletCollider) // Make sure that the bulletCollider is always removed for each renderFrame
		exploded := false
		if nil != collision {
			switch v := bulletCollider.Data.(type) {
			case *MeleeBullet:
				bulletShape := bulletCollider.Shape.(*resolv.ConvexPolygon)
				offender := currRenderFrame.PlayersArr[v.BattleAttr.OffenderJoinIndex-1]
				for _, obj := range collision.Objects {
					defenderShape := obj.Shape.(*resolv.ConvexPolygon)
					switch t := obj.Data.(type) {
					case *PlayerDownsync:
						if v.BattleAttr.OffenderJoinIndex == t.JoinIndex {
							continue
						}
						overlapped, _, _, _ := calcPushbacks(0, 0, bulletShape, defenderShape)
						if !overlapped {
							continue
						}
						exploded = true
						if _, existent := invinsibleSet[t.CharacterState]; existent {
							continue
						}
						if 0 < t.FramesInvinsible {
							continue
						}
						xfac := int32(1) // By now, straight Punch offset doesn't respect "y-axis"
						if 0 > offender.DirX {
							xfac = -xfac
						}
						pushbackVelX, pushbackVelY := xfac*v.Bullet.PushbackVelX, v.Bullet.PushbackVelY
						atkedPlayerInNextFrame := nextRenderFramePlayers[t.JoinIndex-1]
						atkedPlayerInNextFrame.VelX = pushbackVelX
						atkedPlayerInNextFrame.VelY = pushbackVelY
						if v.Bullet.BlowUp {
							atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_BLOWN_UP1
						} else {
							atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ATKED1
						}
						oldFramesToRecover := nextRenderFramePlayers[t.JoinIndex-1].FramesToRecover
						if v.Bullet.HitStunFrames > oldFramesToRecover {
							atkedPlayerInNextFrame.FramesToRecover = v.Bullet.HitStunFrames
						}
					}
				}
			case *FireballBullet:
				bulletShape := bulletCollider.Shape.(*resolv.ConvexPolygon)
				offender := currRenderFrame.PlayersArr[v.BattleAttr.OffenderJoinIndex-1]
				for _, obj := range collision.Objects {
					defenderShape := obj.Shape.(*resolv.ConvexPolygon)
					switch t := obj.Data.(type) {
					case *PlayerDownsync:
						if v.BattleAttr.OffenderJoinIndex == t.JoinIndex {
							continue
						}
						overlapped, _, _, _ := calcPushbacks(0, 0, bulletShape, defenderShape)
						if !overlapped {
							continue
						}
						exploded = true
						if _, existent := invinsibleSet[t.CharacterState]; existent {
							continue
						}
						if 0 < t.FramesInvinsible {
							continue
						}
						xfac := int32(1) // By now, straight Punch offset doesn't respect "y-axis"
						if 0 > offender.DirX {
							xfac = -xfac
						}
						pushbackVelX, pushbackVelY := xfac*v.Bullet.PushbackVelX, v.Bullet.PushbackVelY
						atkedPlayerInNextFrame := nextRenderFramePlayers[t.JoinIndex-1]
						atkedPlayerInNextFrame.VelX = pushbackVelX
						atkedPlayerInNextFrame.VelY = pushbackVelY
						if v.Bullet.BlowUp {
							atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_BLOWN_UP1
						} else {
							atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ATKED1
						}
						oldFramesToRecover := nextRenderFramePlayers[t.JoinIndex-1].FramesToRecover
						if v.Bullet.HitStunFrames > oldFramesToRecover {
							atkedPlayerInNextFrame.FramesToRecover = v.Bullet.HitStunFrames
						}
					default:
						exploded = true
					}
				}
			}
		}
		if exploded {
			switch v := bulletCollider.Data.(type) {
			case *MeleeBullet:
				v.BlState = BULLET_EXPLODING
				v.FramesInBlState = 0
				//fmt.Printf("melee exploded @currRenderFrame.Id=%d, bulletLocalId=%d, blState=%d\n", currRenderFrame.Id, v.BattleAttr.BulletLocalId, v.BlState)
			case *FireballBullet:
				v.BlState = BULLET_EXPLODING
				v.FramesInBlState = 0
				//fmt.Printf("fireball exploded @currRenderFrame.Id=%d, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, blState=%d\n", currRenderFrame.Id, v.BattleAttr.BulletLocalId, v.VirtualGridX, v.VirtualGridY, v.BlState)
			}
		}
	}

	// 6. Get players out of stuck barriers if there's any
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		playerCollider := playerColliders[i]
		// Update "virtual grid position"
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		thatPlayerInNextFrame.VirtualGridX, thatPlayerInNextFrame.VirtualGridY = PolygonColliderBLToVirtualGridPos(playerCollider.X-effPushbacks[joinIndex-1].X, playerCollider.Y-effPushbacks[joinIndex-1].Y, playerCollider.W*0.5, playerCollider.H*0.5, 0, 0, 0, 0, collisionSpaceOffsetX, collisionSpaceOffsetY)

		// Update "CharacterState"
		if thatPlayerInNextFrame.InAir {
			oldNextCharacterState := thatPlayerInNextFrame.CharacterState
			switch oldNextCharacterState {
			case ATK_CHARACTER_STATE_IDLE1, ATK_CHARACTER_STATE_WALKING, ATK_CHARACTER_STATE_TURNAROUND:
				if thatPlayerInNextFrame.OnWall {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ONWALL
				} else if jumpedOrNotList[i] || ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP == currPlayerDownsync.CharacterState {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP
				} else {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP
				}
			case ATK_CHARACTER_STATE_ATK1:
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_ATK1
				// No inAir transition for ATK2/ATK3 for now
			case ATK_CHARACTER_STATE_ATKED1:
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_INAIR_ATKED1
			}
		}

		// Reset "FramesInChState" if "CharacterState" is changed
		if thatPlayerInNextFrame.CharacterState != currPlayerDownsync.CharacterState {
			thatPlayerInNextFrame.FramesInChState = 0
		}

		// Remove any active skill if not attacking
		if _, existent := nonAttackingSet[thatPlayerInNextFrame.CharacterState]; existent {
			thatPlayerInNextFrame.ActiveSkillId = int32(NO_SKILL)
			thatPlayerInNextFrame.ActiveSkillHit = int32(NO_SKILL_HIT)
		}
	}

	for _, playerCollider := range playerColliders {
		playerCollider.Space.Remove(playerCollider)
	}

	return &RoomDownsyncFrame{
		Id:                   currRenderFrame.Id + 1,
		PlayersArr:           nextRenderFramePlayers,
		BulletLocalIdCounter: bulletLocalId,
		MeleeBullets:         nextRenderFrameMeleeBullets,
		FireballBullets:      nextRenderFrameFireballBullets,
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

func NewMeleeBullet(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId, blState, framesInBlState, explosionFrames, speciesId int32) *MeleeBullet {
	return &MeleeBullet{
		BlState:         blState,
		FramesInBlState: framesInBlState,
		BattleAttr: &BulletBattleAttr{
			BulletLocalId:           bulletLocalId,
			OriginatedRenderFrameId: originatedRenderFrameId,
			OffenderJoinIndex:       offenderJoinIndex,
			TeamId:                  teamId,
		},
		Bullet: &BulletConfig{
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

			BlowUp:          blowUp,
			ExplosionFrames: explosionFrames,
			SpeciesId:       speciesId,
		},
	}
}

func NewFireballBullet(bulletLocalId, originatedRenderFrameId, offenderJoinIndex, startupFrames, cancellableStFrame, cancellableEdFrame, activeFrames, hitStunFrames, blockStunFrames, pushbackVelX, pushbackVelY, damage, selfLockVelX, selfLockVelY, hitboxOffsetX, hitboxOffsetY, hitboxSizeX, hitboxSizeY int32, blowUp bool, teamId int32, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed, blState, framesInBlState, explosionFrames, speciesId int32) *FireballBullet {
	return &FireballBullet{
		VirtualGridX: virtualGridX,
		VirtualGridY: virtualGridY,
		DirX:         dirX,
		DirY:         dirY,
		VelX:         velX,
		VelY:         velY,
		Speed:        speed,
		BattleAttr: &BulletBattleAttr{
			BulletLocalId:           bulletLocalId,
			OriginatedRenderFrameId: originatedRenderFrameId,
			OffenderJoinIndex:       offenderJoinIndex,
			TeamId:                  teamId,
		},
		Bullet: &BulletConfig{
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

			BlowUp:          blowUp,
			ExplosionFrames: explosionFrames,
			SpeciesId:       speciesId,
		},
	}
}
