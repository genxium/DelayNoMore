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

	WORLD_TO_VIRTUAL_GRID_RATIO = float64(10.0)
	VIRTUAL_GRID_TO_WORLD_RATIO = float64(1.0) / WORLD_TO_VIRTUAL_GRID_RATIO

	GRAVITY_X = int32(0)
	GRAVITY_Y = -int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO) // makes all "playerCollider.Y" a multiple of 0.5 in all cases

	INPUT_DELAY_FRAMES = int32(4) // in the count of render frames

	/*
	   [WARNING]
	   Experimentally having an input rate > 15 (e.g., 60 >> 2) doesn't improve multiplayer smoothness, in fact higher input rate often results in higher packet loss (both TCP and UDP) thus higher wrong prediction rate!
	*/
	INPUT_SCALE_FRAMES = uint32(2) // inputDelayedAndScaledFrameId = ((originalFrameId - InputDelayFrames) >> InputScaleFrames)

	SP_ATK_LOOKUP_FRAMES = int32(5)

	SNAP_INTO_PLATFORM_OVERLAP   = float64(0.1)
	SNAP_INTO_PLATFORM_THRESHOLD = float64(0.5)
	VERTICAL_PLATFORM_THRESHOLD  = float64(0.9)
	MAGIC_FRAMES_TO_BE_ONWALL    = int32(12)

	DYING_FRAMES_TO_RECOVER = int32(60) // MUST BE SAME FOR EVERY CHARACTER FOR FAIRNESS!

	NO_SKILL     = -1
	NO_SKILL_HIT = -1

	NO_LOCK_VEL = int32(-1)

	// Used in preallocated RoomDownsyncFrame to check termination
	TERMINATING_BULLET_LOCAL_ID = int32(-1)
	TERMINATING_PLAYER_ID       = int32(-1)
	TERMINATING_RENDER_FRAME_ID = int32(-1)
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
	ATK_CHARACTER_STATE_DYING      = int32(18)
)

var inAirSet = map[int32]bool{
	ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP: true,
	ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP: true,
	ATK_CHARACTER_STATE_INAIR_ATK1:          true,
	ATK_CHARACTER_STATE_INAIR_ATKED1:        true,
	ATK_CHARACTER_STATE_BLOWN_UP1:           true,
	ATK_CHARACTER_STATE_ONWALL:              true,
	ATK_CHARACTER_STATE_DASHING:             true, // Yes dashing is an inair state even if you dashed on the ground :)
}

var noOpSet = map[int32]bool{
	ATK_CHARACTER_STATE_ATKED1:       true,
	ATK_CHARACTER_STATE_INAIR_ATKED1: true,
	ATK_CHARACTER_STATE_BLOWN_UP1:    true,
	ATK_CHARACTER_STATE_LAY_DOWN1:    true,
	// [WARNING] During the invinsible frames of GET_UP1, the player is allowed to take any action
	ATK_CHARACTER_STATE_DYING: true,
}

var invinsibleSet = map[int32]bool{
	ATK_CHARACTER_STATE_BLOWN_UP1: true,
	ATK_CHARACTER_STATE_LAY_DOWN1: true,
	ATK_CHARACTER_STATE_GET_UP1:   true,
	ATK_CHARACTER_STATE_DYING:     true,
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
	ATK_CHARACTER_STATE_DYING:               true,
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
	aCnt, bCnt := a.Points.Cnt, b.Points.Cnt
	// Single point case
	if 1 == aCnt && 1 == bCnt {
		if nil != result {
			result.Overlap = 0
		}
		aPoint := a.GetPointByOffset(0)
		bPoint := b.GetPointByOffset(0)
		return aPoint[0] == bPoint[0] && aPoint[1] == bPoint[1]
	}

	if 1 < aCnt {
		// Deliberately using "Points" instead of "SATAxes" to avoid unnecessary heap memory alloc
		for i := int32(0); i < a.Points.Cnt; i++ {
			u, v := a.GetPointByOffset(i), a.GetPointByOffset(0)
			if i != a.Points.Cnt-1 {
				v = a.GetPointByOffset(i + 1)
			}
			dy := v[1] - u[1]
			dx := v[0] - u[0]
			axis := resolv.Vector{dy, -dx}.Unit()
			if isPolygonPairSeparatedByDir(a, b, axis, result) {
				return false
			}
		}
	}

	if 1 < bCnt {
		for i := int32(0); i < b.Points.Cnt; i++ {
			u, v := b.GetPointByOffset(i), b.GetPointByOffset(0)
			if i != b.Points.Cnt-1 {
				v = b.GetPointByOffset(i + 1)
			}
			dy := v[1] - u[1]
			dx := v[0] - u[0]
			axis := resolv.Vector{dy, -dx}.Unit()
			if isPolygonPairSeparatedByDir(a, b, axis, result) {
				return false
			}
		}
	}

	return true
}

func IsGeneralBulletActive(blState, originatedRenderFrameId, startupFrames, activeFrames, renderFrameId int32) bool {
	if BULLET_EXPLODING == blState {
		return false
	}
	return (originatedRenderFrameId+startupFrames < renderFrameId) && (originatedRenderFrameId+startupFrames+activeFrames > renderFrameId)
}

func IsMeleeBulletActive(meleeBullet *MeleeBullet, currRenderFrame *RoomDownsyncFrame) bool {
	return IsGeneralBulletActive(meleeBullet.BlState, meleeBullet.BattleAttr.OriginatedRenderFrameId, meleeBullet.Bullet.StartupFrames, meleeBullet.Bullet.ActiveFrames, currRenderFrame.Id)
}

func IsMeleeBulletAlive(meleeBullet *MeleeBullet, currRenderFrame *RoomDownsyncFrame) bool {
	if BULLET_EXPLODING == meleeBullet.BlState {
		return meleeBullet.FramesInBlState < meleeBullet.Bullet.ExplosionFrames
	}
	return (meleeBullet.BattleAttr.OriginatedRenderFrameId+meleeBullet.Bullet.StartupFrames+meleeBullet.Bullet.ActiveFrames > currRenderFrame.Id)
}

func IsFireballBulletActive(fireballBullet *FireballBullet, currRenderFrame *RoomDownsyncFrame) bool {
	return IsGeneralBulletActive(fireballBullet.BlState, fireballBullet.BattleAttr.OriginatedRenderFrameId, fireballBullet.Bullet.StartupFrames, fireballBullet.Bullet.ActiveFrames, currRenderFrame.Id)
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
	for i := int32(0); i < a.Points.Cnt; i++ {
		p := a.GetPointByOffset(i)
		dot := (p[0]+a.X)*e[0] + (p[1]+a.Y)*e[1]

		if aStart > dot {
			aStart = dot
		}

		if aEnd < dot {
			aEnd = dot
		}
	}

	for i := int32(0); i < b.Points.Cnt; i++ {
		p := b.GetPointByOffset(i)
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

func calcHardPushbacksNorms(joinIndex int32, currPlayerDownsync, thatPlayerInNextFrame *PlayerDownsync, playerCollider *resolv.Object, playerShape *resolv.ConvexPolygon, snapIntoPlatformOverlap float64, effPushback *Vec2D, hardPushbackNorms []*Vec2D, collision *resolv.Collision) int {
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
	retCnt := 0
	collided := playerCollider.CheckAllWithHolder(virtualGripToWall, 0, collision)
	if !collided {
		return retCnt
	}

	//playerColliderCenterX, playerColliderCenterY := playerCollider.Center()
	//fmt.Printf("joinIndex=%d calcHardPushbacksNorms has non-empty collision;playerColliderPos=(%.2f,%.2f)\n", joinIndex, playerColliderCenterX, playerColliderCenterY)
	for true {
		obj := collision.PopFirstCollidedObject()
		if nil == obj {
			break
		}
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
		hardPushbackNorms[retCnt].X, hardPushbackNorms[retCnt].Y = overlapResult.OverlapX, overlapResult.OverlapY
		effPushback.X += pushbackX
		effPushback.Y += pushbackY
		retCnt++
		//fmt.Printf("joinIndex=%d calcHardPushbacksNorms found one hardpushback; immediatePushback=(%.2f,%.2f)\n", joinIndex, pushbackX, pushbackY)
	}
	return retCnt
}

func UpdateInputFrameInPlaceUponDynamics(inputFrameId int32, roomCapacity int, confirmedList uint64, inputList []uint64, lastIndividuallyConfirmedInputFrameId []int32, lastIndividuallyConfirmedInputList []uint64, toExcludeJoinIndexUpdateInputFrameInPlaceUponDynamics int32) bool {
	hasInputFrameUpdatedOnDynamics := false
	for i := 0; i < roomCapacity; i++ {
		if int32(i+1) == toExcludeJoinIndexUpdateInputFrameInPlaceUponDynamics {
			// On frontend, a "self input" is only confirmed by websocket downsync, which is quite late and might get the "self input" incorrectly overwritten if not excluded here
			continue
		}
		if 0 < (confirmedList & (1 << uint32(i))) {
			// This in-place update on the "inputsBuffer" is only correct when "delayed input for this player is not yet confirmed"
			continue
		}
		if lastIndividuallyConfirmedInputFrameId[i] >= inputFrameId {
			continue
		}
		newVal := (lastIndividuallyConfirmedInputList[i] & uint64(15))
		if newVal != inputList[i] {
			inputList[i] = newVal
			hasInputFrameUpdatedOnDynamics = true
		}
	}
	return hasInputFrameUpdatedOnDynamics
}

func deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame *PlayerDownsync, currRenderFrame *RoomDownsyncFrame, chConfig *CharacterConfig, inputsBuffer *resolv.RingBuffer) (int, bool, int32, int32) {
	// returns (patternId, jumpedOrNot, effectiveDx, effectiveDy)
	delayedInputFrameId := ConvertToDelayedInputFrameId(currRenderFrame.Id)
	delayedInputFrameIdForPrevRdf := ConvertToDelayedInputFrameId(currRenderFrame.Id - 1)

	if 0 >= delayedInputFrameId {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}

	if _, existent := noOpSet[currPlayerDownsync.CharacterState]; existent {
		return PATTERN_ID_UNABLE_TO_OP, false, 0, 0
	}

	delayedInputFrameDownsync := inputsBuffer.GetByFrameId(delayedInputFrameId).(*InputFrameDownsync)
	delayedInputList := delayedInputFrameDownsync.InputList

	var delayedInputListForPrevRdf []uint64 = nil
	if 0 < delayedInputFrameIdForPrevRdf {
		delayedInputFrameDownsyncForPrevRdf := inputsBuffer.GetByFrameId(delayedInputFrameIdForPrevRdf).(*InputFrameDownsync)
		delayedInputListForPrevRdf = delayedInputFrameDownsyncForPrevRdf.InputList
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

	// Jumping is partially allowed within "CapturedByInertia", but moving is only allowed when "0 == FramesToRecover" (constrained later in "ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame")
	if 0 == currPlayerDownsync.FramesToRecover {
		effDx, effDy = decodedInput.Dx, decodedInput.Dy
	}

	patternId := PATTERN_ID_NO_OP
	canJumpWithinInertia := currPlayerDownsync.CapturedByInertia && ((chConfig.InertiaFramesToRecover >> 1) > currPlayerDownsync.FramesToRecover)
	if 0 == currPlayerDownsync.FramesToRecover || canJumpWithinInertia {
		if decodedInput.BtnBLevel > prevBtnBLevel {
			if chConfig.DashingEnabled && 0 > decodedInput.Dy && ATK_CHARACTER_STATE_DASHING != currPlayerDownsync.CharacterState {
				// Checking "DashingEnabled" here to allow jumping when dashing-disabled players pressed "DOWN + BtnB"
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
				if 0 > decodedInput.Dy {
					patternId = 3
				} else if 0 < decodedInput.Dy {
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

/*
[LONG TERM PERFORMANCE ENHANCEMENT PLAN]

The function "ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame" is creating new heap-memory blocks at 60fps, e.g. nextRenderFramePlayers & nextRenderFrameMeleeBullets & nextRenderFrameFireballBullets & effPushbacks & hardPushbackNorms & jumpedOrNotList & dynamicRectangleColliders("player" & "bullet"), which would induce "possibly performance impacting garbage collections" when many rooms are running simultaneously.
*/
func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(inputsBuffer *resolv.RingBuffer, currRenderFrameId int32, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, collisionSpaceOffsetX, collisionSpaceOffsetY float64, chConfigsOrderedByJoinIndex []*CharacterConfig, renderFrameBuffer *resolv.RingBuffer, collision *resolv.Collision, effPushbacks []*Vec2D, hardPushbackNormsArr [][]*Vec2D, jumpedOrNotList []bool, dynamicRectangleColliders []*resolv.Object, lastIndividuallyConfirmedInputFrameId []int32, lastIndividuallyConfirmedInputList []uint64, allowUpdateInputFrameInPlaceUponDynamics bool, toExcludeJoinIndexUpdateInputFrameInPlaceUponDynamics int32) bool {
	hasInputFrameUpdatedOnDynamics := false
	currRenderFrame := renderFrameBuffer.GetByFrameId(currRenderFrameId).(*RoomDownsyncFrame)
	nextRenderFrameId := currRenderFrameId + 1
	roomCapacity := len(currRenderFrame.PlayersArr)
	var ret *RoomDownsyncFrame = nil
	candidate := renderFrameBuffer.GetByFrameId(nextRenderFrameId)
	if nil == candidate {
		if nextRenderFrameId == renderFrameBuffer.EdFrameId {
			renderFrameBuffer.DryPut()
			candidate = renderFrameBuffer.GetByFrameId(nextRenderFrameId)
			if nil == candidate {
				// Lazy alloc heap-mem for holder
				ret = NewPreallocatedRoomDownsyncFrame(roomCapacity, 64, 64)
				renderFrameBuffer.SetByFrameId(ret, nextRenderFrameId)
			} else {
				ret = candidate.(*RoomDownsyncFrame)
			}
		} else {
			panic("Invalid nextRenderFrameId=" + string(nextRenderFrameId) + "!")
		}
	} else {
		ret = candidate.(*RoomDownsyncFrame)
	}
	// [WARNING] On backend this function MUST BE called while "InputsBufferLock" is locked!
	nextRenderFramePlayers := ret.PlayersArr
	// Make a copy first
	for i, src := range currRenderFrame.PlayersArr {
		framesToRecover := src.FramesToRecover - 1
		framesInChState := src.FramesInChState + 1
		framesInvinsible := src.FramesInvinsible - 1
		if framesToRecover < 0 {
			framesToRecover = 0
		}
		if framesInvinsible < 0 {
			framesInvinsible = 0
		}
		ClonePlayerDownsync(src.Id, src.VirtualGridX, src.VirtualGridY, src.DirX, src.DirY, src.VelX, src.VelY, framesToRecover, framesInChState, src.ActiveSkillId, src.ActiveSkillHit, framesInvinsible, src.Speed, src.BattleState, src.CharacterState, src.JoinIndex, src.Hp, src.MaxHp, src.ColliderRadius, true, false, src.OnWallNormX, src.OnWallNormY, src.CapturedByInertia, src.BulletTeamId, src.ChCollisionTeamId, src.RevivalVirtualGridX, src.RevivalVirtualGridY, nextRenderFramePlayers[i])
	}

	meleeBulletCnt := 0
	nextRenderFrameMeleeBullets := ret.MeleeBullets
	fireballBulletCnt := 0
	nextRenderFrameFireballBullets := ret.FireballBullets

	bulletLocalId := currRenderFrame.BulletLocalIdCounter
	// 1. Process player inputs
	delayedInputFrameId := ConvertToDelayedInputFrameId(currRenderFrame.Id)

	if 0 < delayedInputFrameId {
		delayedInputFrameDownsync := inputsBuffer.GetByFrameId(delayedInputFrameId).(*InputFrameDownsync)
		delayedInputList := delayedInputFrameDownsync.InputList
		roomCapacity := len(delayedInputList)
		if allowUpdateInputFrameInPlaceUponDynamics {
			hasInputFrameUpdatedOnDynamics = UpdateInputFrameInPlaceUponDynamics(delayedInputFrameId, roomCapacity, delayedInputFrameDownsync.ConfirmedList, delayedInputList, lastIndividuallyConfirmedInputFrameId, lastIndividuallyConfirmedInputList, toExcludeJoinIndexUpdateInputFrameInPlaceUponDynamics)
		}
	}

	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		chConfig := chConfigsOrderedByJoinIndex[i]
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		patternId, jumpedOrNot, effDx, effDy := deriveOpPattern(currPlayerDownsync, thatPlayerInNextFrame, currRenderFrame, chConfig, inputsBuffer)

		jumpedOrNotList[i] = jumpedOrNot
		joinIndex := currPlayerDownsync.JoinIndex
		skillId := chConfig.SkillMapper(patternId, currPlayerDownsync, chConfig.SpeciesId)
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
				CloneMeleeBullet(BULLET_STARTUP, 0, bulletLocalId, currRenderFrameId, joinIndex, currPlayerDownsync.BulletTeamId, v.Bullet, nextRenderFrameMeleeBullets[meleeBulletCnt])
				bulletLocalId++
				meleeBulletCnt++
				if NO_LOCK_VEL != v.Bullet.SelfLockVelX {
					hasLockVel = true
					thatPlayerInNextFrame.VelX = xfac * v.Bullet.SelfLockVelX
				}
				if NO_LOCK_VEL != v.Bullet.SelfLockVelY {
					hasLockVel = true
					thatPlayerInNextFrame.VelY = v.Bullet.SelfLockVelY
				}
			case *FireballBullet:
				CloneFireballBullet(BULLET_STARTUP, 0, currPlayerDownsync.VirtualGridX+xfac*v.Bullet.HitboxOffsetX, currPlayerDownsync.VirtualGridY+v.Bullet.HitboxOffsetY, xfac, 0, v.Speed*xfac, 0, v.Speed, bulletLocalId, currRenderFrameId, joinIndex, currPlayerDownsync.BulletTeamId, v.Bullet, nextRenderFrameFireballBullets[fireballBulletCnt])
				bulletLocalId++
				fireballBulletCnt++
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
			isWallJumping := (chConfig.OnWallEnabled && chConfig.WallJumpingInitVelX == intAbs(currPlayerDownsync.VelX))
			/*
			   if isWallJumping {
			       fmt.Printf("joinIndex=%d is wall jumping\n{renderFrame.id: %d, currPlayerDownsync.Speed: %d, currPlayerDownsync.VelX: %d}\n", currPlayerDownsync.JoinIndex, currRenderFrame.Id, currPlayerDownsync.Speed, currPlayerDownsync.VelX)
			   }
			*/
			alignedWithInertia := true
			exactTurningAround := false
			stoppingFromWalking := false
			if 0 != effDx && 0 == thatPlayerInNextFrame.VelX {
				alignedWithInertia = false
			} else if 0 == effDx && 0 != thatPlayerInNextFrame.VelX {
				alignedWithInertia = false
				stoppingFromWalking = true
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
				if exactTurningAround {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_TURNAROUND
					thatPlayerInNextFrame.FramesToRecover = chConfig.InertiaFramesToRecover
				} else if stoppingFromWalking {
					thatPlayerInNextFrame.FramesToRecover = chConfig.InertiaFramesToRecover
				} else {
					// Updates CharacterState and thus the animation to make user see graphical feedback asap.
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_WALKING
					thatPlayerInNextFrame.FramesToRecover = (chConfig.InertiaFramesToRecover >> 1)
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

	/*
	    [WARNING]
	   1. The dynamic colliders will all be removed from "Space" at the end of this function due to the need for being rollback-compatible.
	   2. To achieve "zero gc" in "ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame", I deliberately chose a collision system that doesn't use dynamic tree node alloc.
	*/
	colliderCnt := 0

	// 2. Process player movement
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y = float64(0), float64(0)
		thatPlayerInNextFrame := nextRenderFramePlayers[i]

		chConfig := chConfigsOrderedByJoinIndex[i]
		// Reset playerCollider position from the "virtual grid position"
		newVx, newVy := currPlayerDownsync.VirtualGridX+currPlayerDownsync.VelX, currPlayerDownsync.VirtualGridY+currPlayerDownsync.VelY
		if 0 >= thatPlayerInNextFrame.Hp && 0 == thatPlayerInNextFrame.FramesToRecover {
			// Revive from Dying
			newVx, newVy = currPlayerDownsync.RevivalVirtualGridX, currPlayerDownsync.RevivalVirtualGridY
			thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_GET_UP1
			thatPlayerInNextFrame.FramesInChState = ATK_CHARACTER_STATE_GET_UP1
			thatPlayerInNextFrame.FramesToRecover = chConfig.GetUpFramesToRecover
			thatPlayerInNextFrame.FramesInvinsible = chConfig.GetUpInvinsibleFrames
			thatPlayerInNextFrame.Hp = currPlayerDownsync.MaxHp
			// Hardcoded initial character orientation/facing
			if 0 == (thatPlayerInNextFrame.JoinIndex % 2) {
				thatPlayerInNextFrame.DirX = -2
				thatPlayerInNextFrame.DirY = 0
			} else {
				thatPlayerInNextFrame.DirX = +2
				thatPlayerInNextFrame.DirY = 0
			}
		}
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

		playerCollider := dynamicRectangleColliders[colliderCnt]
		UpdateRectCollider(playerCollider, wx, wy, colliderWorldWidth, colliderWorldHeight, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, currPlayerDownsync, "Player") // the coords of all barrier boundaries are multiples of tileWidth(i.e. 16), by adding snapping y-padding when "landedOnGravityPushback" all "playerCollider.Y" would be a multiple of 1.0
		colliderCnt++

		// Add to collision system
		collisionSys.AddSingle(playerCollider)

		if currPlayerDownsync.InAir {
			if ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState && !jumpedOrNotList[i] {
				thatPlayerInNextFrame.VelX += GRAVITY_X
				thatPlayerInNextFrame.VelY = chConfig.WallSlidingVelY
			} else if ATK_CHARACTER_STATE_DASHING == currPlayerDownsync.CharacterState {
				thatPlayerInNextFrame.VelX += GRAVITY_X
			} else {
				thatPlayerInNextFrame.VelX += GRAVITY_X
				thatPlayerInNextFrame.VelY += GRAVITY_Y
			}
		}
	}

	// 3. Add bullet colliders into collision system; [DIRTY TRICK] Players always precede bullets in "dynamicRectangleColliders".
	// [WARNING] For rollback compatibility, static data of "BulletConfig" & "BattleAttr(static since instantiated)" can just be copies of the pointers in "RenderFrameBuffer", however, FireballBullets movement data as well as bullet animation data must be copies of instances for each RenderFrame!
	for _, prevFireball := range currRenderFrame.FireballBullets {
		if TERMINATING_BULLET_LOCAL_ID == prevFireball.BattleAttr.BulletLocalId {
			break
		}
		fireballBullet := nextRenderFrameFireballBullets[fireballBulletCnt]
		CloneFireballBullet(prevFireball.BlState, prevFireball.FramesInBlState+1, prevFireball.VirtualGridX, prevFireball.VirtualGridY, prevFireball.DirX, prevFireball.DirY, prevFireball.VelX, prevFireball.VelY, prevFireball.Speed, prevFireball.BattleAttr.BulletLocalId, prevFireball.BattleAttr.OriginatedRenderFrameId, prevFireball.BattleAttr.OffenderJoinIndex, prevFireball.BattleAttr.TeamId, prevFireball.Bullet, fireballBullet)

		if IsFireballBulletAlive(fireballBullet, currRenderFrame) {
			if IsFireballBulletActive(fireballBullet, currRenderFrame) {
				bulletWx, bulletWy := VirtualGridToWorldPos(fireballBullet.VirtualGridX, fireballBullet.VirtualGridY)
				hitboxSizeWx, hitboxSizeWy := VirtualGridToWorldPos(fireballBullet.Bullet.HitboxSizeX, fireballBullet.Bullet.HitboxSizeY)

				newBulletCollider := dynamicRectangleColliders[colliderCnt]
				UpdateRectCollider(newBulletCollider, bulletWx, bulletWy, hitboxSizeWx, hitboxSizeWy, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, fireballBullet, "FireballBullet")
				colliderCnt++

				collisionSys.AddSingle(newBulletCollider)
				fireballBullet.BlState = BULLET_ACTIVE
				if fireballBullet.BlState != prevFireball.BlState {
					fireballBullet.FramesInBlState = 0
				}
				fireballBullet.VirtualGridX, fireballBullet.VirtualGridY = fireballBullet.VirtualGridX+fireballBullet.VelX, fireballBullet.VirtualGridY+fireballBullet.VelY
				//fmt.Printf("Pushing active fireball to next frame @currRenderFrame.Id=%d, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, blState=%d\n", currRenderFrame.Id, fireballBullet.BattleAttr.BulletLocalId, fireballBullet.VirtualGridX, fireballBullet.VirtualGridY, fireballBullet.BlState)
			} else {
				offender := currRenderFrame.PlayersArr[fireballBullet.BattleAttr.OffenderJoinIndex-1]
				if _, existent := noOpSet[offender.CharacterState]; existent {
					// If a fireball is not yet active but the offender got attacked, remove it
					continue
				}
				//fmt.Printf("Pushing non-active fireball to next frame @currRenderFrame.Id=%d, bulletLocalId=%d, virtualGridX=%d, virtualGridY=%d, blState=%d\n", currRenderFrame.Id, fireballBullet.BattleAttr.BulletLocalId, fireballBullet.VirtualGridX, fireballBullet.VirtualGridY, fireballBullet.BlState)
			}
			fireballBulletCnt++
		}
	}
	// Explicitly specify termination of fireball bullets
	nextRenderFrameFireballBullets[fireballBulletCnt].BattleAttr.BulletLocalId = TERMINATING_BULLET_LOCAL_ID

	for _, prevMelee := range currRenderFrame.MeleeBullets {
		if TERMINATING_BULLET_LOCAL_ID == prevMelee.BattleAttr.BulletLocalId {
			break
		}
		meleeBullet := nextRenderFrameMeleeBullets[meleeBulletCnt]
		CloneMeleeBullet(prevMelee.BlState, prevMelee.FramesInBlState+1, prevMelee.BattleAttr.BulletLocalId, prevMelee.BattleAttr.OriginatedRenderFrameId, prevMelee.BattleAttr.OffenderJoinIndex, prevMelee.BattleAttr.TeamId, prevMelee.Bullet, meleeBullet)

		if IsMeleeBulletAlive(meleeBullet, currRenderFrame) {
			offender := currRenderFrame.PlayersArr[meleeBullet.BattleAttr.OffenderJoinIndex-1]
			if _, existent := noOpSet[offender.CharacterState]; existent {
				// If a melee is alive but the offender got attacked, remove it even if it's active
				continue
			}
			if IsMeleeBulletActive(meleeBullet, currRenderFrame) {
				xfac := int32(1) // By now, straight Punch offset doesn't respect "y-axis"
				if 0 > offender.DirX {
					xfac = -xfac
				}
				bulletWx, bulletWy := VirtualGridToWorldPos(offender.VirtualGridX+xfac*meleeBullet.Bullet.HitboxOffsetX, offender.VirtualGridY)
				hitboxSizeWx, hitboxSizeWy := VirtualGridToWorldPos(meleeBullet.Bullet.HitboxSizeX, meleeBullet.Bullet.HitboxSizeY)

				newBulletCollider := dynamicRectangleColliders[colliderCnt]
				UpdateRectCollider(newBulletCollider, bulletWx, bulletWy, hitboxSizeWx, hitboxSizeWy, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, SNAP_INTO_PLATFORM_OVERLAP, collisionSpaceOffsetX, collisionSpaceOffsetY, meleeBullet, "MeleeBullet")
				colliderCnt++

				collisionSys.AddSingle(newBulletCollider)
				meleeBullet.BlState = BULLET_ACTIVE
				if meleeBullet.BlState != prevMelee.BlState {
					meleeBullet.FramesInBlState = 0
				}
			}
			meleeBulletCnt++
		}
	}
	// Explicitly specify termination of melee bullets
	nextRenderFrameMeleeBullets[meleeBulletCnt].BattleAttr.BulletLocalId = TERMINATING_BULLET_LOCAL_ID

	// 4. Calc pushbacks for each player (after its movement) w/o bullets
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		playerCollider := dynamicRectangleColliders[i]
		playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		hardPushbackCnt := calcHardPushbacksNorms(joinIndex, currPlayerDownsync, thatPlayerInNextFrame, playerCollider, playerShape, SNAP_INTO_PLATFORM_OVERLAP, effPushbacks[joinIndex-1], hardPushbackNormsArr[joinIndex-1], collision)
		chConfig := chConfigsOrderedByJoinIndex[i]
		landedOnGravityPushback := false

		if collided := playerCollider.CheckAllWithHolder(0, 0, collision); collided {
			for true {
				obj := collision.PopFirstCollidedObject()
				if nil == obj {
					break
				}
				isBarrier, isAnotherPlayer, isBullet := false, false, false
				switch v := obj.Data.(type) {
				case *PlayerDownsync:
					if ATK_CHARACTER_STATE_DYING == v.CharacterState {
						// ignore collision with dying player
						continue
					}
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
				for i := 0; i < hardPushbackCnt; i++ {
					hardPushbackNorm := hardPushbackNormsArr[joinIndex-1][i]
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
					//fmt.Printf("joinIndex=%d landedOnGravityPushback\n{renderFrame.id: %d, isBarrier: %v, isAnotherPlayer: %v}\nhardPushbackNormsOfThisPlayer=%v, playerColliderPos=(%.2f,%.2f), immediatePushback={%.3f, %.3f}, effPushback={%.3f, %.3f}, overlapMag=%.4f\n", joinIndex, currRenderFrame.Id, isBarrier, isAnotherPlayer, hardPushbackNorms[joinIndex-1], playerColliderCenterX, playerColliderCenterY, pushbackX, pushbackY, effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y, overlapResult.Overlap)
				}
			}
		}

		if landedOnGravityPushback {
			thatPlayerInNextFrame.InAir = false
			fallStopping := (currPlayerDownsync.InAir && 0 >= currPlayerDownsync.VelY)
			if fallStopping {
				thatPlayerInNextFrame.VelY = 0
				thatPlayerInNextFrame.VelX = 0
				if ATK_CHARACTER_STATE_DYING == thatPlayerInNextFrame.CharacterState {

					// No update needed for Dying
				} else if ATK_CHARACTER_STATE_BLOWN_UP1 == thatPlayerInNextFrame.CharacterState {
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
				// landedOnGravityPushback not fallStopping, could be in LayDown or GetUp or Dying
				if _, existent := nonAttackingSet[thatPlayerInNextFrame.CharacterState]; existent {
					if ATK_CHARACTER_STATE_DYING == thatPlayerInNextFrame.CharacterState {
						thatPlayerInNextFrame.VelY = 0
						thatPlayerInNextFrame.VelX = 0
					} else if ATK_CHARACTER_STATE_LAY_DOWN1 == thatPlayerInNextFrame.CharacterState {
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
					for i := 0; i < hardPushbackCnt; i++ {
						hardPushbackNorm := hardPushbackNormsArr[joinIndex-1][i]
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
				}
			}
			if !thatPlayerInNextFrame.OnWall {
				thatPlayerInNextFrame.OnWallNormX, thatPlayerInNextFrame.OnWallNormY = 0, 0
			}
		}
	}

	// 5. Check bullet-anything collisions
	for i := len(nextRenderFramePlayers); i < colliderCnt; i++ {
		bulletCollider := dynamicRectangleColliders[i]
		collided := bulletCollider.CheckAllWithHolder(0, 0, collision)
		if !collided {
			continue
		}

		exploded := false
		explodedOnAnotherPlayer := false

		var bulletStaticAttr *BulletConfig = nil
		var bulletBattleAttr *BulletBattleAttr = nil
		switch v := bulletCollider.Data.(type) {
		case *MeleeBullet:
			bulletStaticAttr = v.Bullet
			bulletBattleAttr = v.BattleAttr
		case *FireballBullet:
			bulletStaticAttr = v.Bullet
			bulletBattleAttr = v.BattleAttr
		}

		bulletShape := bulletCollider.Shape.(*resolv.ConvexPolygon)
		offender := currRenderFrame.PlayersArr[bulletBattleAttr.OffenderJoinIndex-1]
		for true {
			obj := collision.PopFirstCollidedObject()
			if nil == obj {
				break
			}
			defenderShape := obj.Shape.(*resolv.ConvexPolygon)
			switch t := obj.Data.(type) {
			case *PlayerDownsync:
				if bulletBattleAttr.OffenderJoinIndex == t.JoinIndex {
					continue
				}
				overlapped, _, _, _ := calcPushbacks(0, 0, bulletShape, defenderShape)
				if !overlapped {
					continue
				}
				if _, existent := invinsibleSet[t.CharacterState]; existent {
					continue
				}
				if 0 < t.FramesInvinsible {
					continue
				}
				exploded = true
				explodedOnAnotherPlayer = true
				xfac := int32(1) // By now, straight Punch offset doesn't respect "y-axis"
				if 0 > offender.DirX {
					xfac = -xfac
				}
				atkedPlayerInNextFrame := nextRenderFramePlayers[t.JoinIndex-1]
				atkedPlayerInNextFrame.Hp -= bulletStaticAttr.Damage
				pushbackVelX, pushbackVelY := xfac*bulletStaticAttr.PushbackVelX, bulletStaticAttr.PushbackVelY
				atkedPlayerInNextFrame.VelX = pushbackVelX
				atkedPlayerInNextFrame.VelY = pushbackVelY
				if 0 >= atkedPlayerInNextFrame.Hp {
					// [WARNING] We don't have "dying in air" animation for now, and for better graphical recognition, play the same dying animation even in air
					atkedPlayerInNextFrame.Hp = 0
					atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_DYING
					atkedPlayerInNextFrame.FramesToRecover = DYING_FRAMES_TO_RECOVER
				} else {
					if bulletStaticAttr.BlowUp {
						atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_BLOWN_UP1
					} else {
						atkedPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ATKED1
					}
					oldFramesToRecover := nextRenderFramePlayers[t.JoinIndex-1].FramesToRecover
					if bulletStaticAttr.HitStunFrames > oldFramesToRecover {
						atkedPlayerInNextFrame.FramesToRecover = bulletStaticAttr.HitStunFrames
					}
				}
			default:
				exploded = true
			}
		}

		if exploded {
			switch v := bulletCollider.Data.(type) {
			case *MeleeBullet:
				v.BlState = BULLET_EXPLODING
				if explodedOnAnotherPlayer {
					v.FramesInBlState = 0
				} else {
					// When hitting a barrier, don't play explosion anim
					v.FramesInBlState = v.Bullet.ExplosionFrames + 1
				}
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
		playerCollider := dynamicRectangleColliders[i]
		// Update "virtual grid position"
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		thatPlayerInNextFrame.VirtualGridX, thatPlayerInNextFrame.VirtualGridY = PolygonColliderBLToVirtualGridPos(playerCollider.X-effPushbacks[joinIndex-1].X, playerCollider.Y-effPushbacks[joinIndex-1].Y, playerCollider.W*0.5, playerCollider.H*0.5, 0, 0, 0, 0, collisionSpaceOffsetX, collisionSpaceOffsetY)

		// Update "CharacterState"
		if thatPlayerInNextFrame.InAir {
			oldNextCharacterState := thatPlayerInNextFrame.CharacterState
			switch oldNextCharacterState {
			case ATK_CHARACTER_STATE_IDLE1, ATK_CHARACTER_STATE_WALKING, ATK_CHARACTER_STATE_TURNAROUND:
				if jumpedOrNotList[i] || ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP == currPlayerDownsync.CharacterState {
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

		if thatPlayerInNextFrame.OnWall {
			switch thatPlayerInNextFrame.CharacterState {
			case ATK_CHARACTER_STATE_WALKING, ATK_CHARACTER_STATE_INAIR_IDLE1_BY_JUMP, ATK_CHARACTER_STATE_INAIR_IDLE1_NO_JUMP:
				hasBeenOnWallChState := (ATK_CHARACTER_STATE_ONWALL == currPlayerDownsync.CharacterState)
				hasBeenOnWallCollisionResultForSameChState := (currPlayerDownsync.OnWall && MAGIC_FRAMES_TO_BE_ONWALL <= thatPlayerInNextFrame.FramesInChState)
				if hasBeenOnWallChState || hasBeenOnWallCollisionResultForSameChState {
					thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_ONWALL
				}
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

	for i := 0; i < colliderCnt; i++ {
		dynamicCollider := dynamicRectangleColliders[i]
		dynamicCollider.Space.RemoveSingle(dynamicCollider)
	}

	ret.Id = nextRenderFrameId
	ret.BulletLocalIdCounter = bulletLocalId

	return hasInputFrameUpdatedOnDynamics
}

func GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) *resolv.Object {
	blX, blY := WorldToPolygonColliderBLPos(wx, wy, w*0.5, h*0.5, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY)
	return generateRectColliderInCollisionSpace(blX, blY, leftPadding+w+rightPadding, bottomPadding+h+topPadding, data, tag)
}

func generateRectColliderInCollisionSpace(blX, blY, w, h float64, data interface{}, tag string) *resolv.Object {
	collider := resolv.NewObjectSingleTag(blX, blY, w, h, tag) // Unlike its frontend counter part, the position of a "resolv.Object" must be specified by "bottom-left point" because "w" and "h" must be positive, see "resolv.Object.BoundsToSpace" for details
	shape := resolv.NewRectangle(0, 0, w, h)
	collider.SetShape(shape)
	collider.Data = data
	return collider
}

func UpdateRectCollider(collider *resolv.Object, wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, data interface{}, tag string) {
	blX, blY := WorldToPolygonColliderBLPos(wx, wy, w*0.5, h*0.5, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY)
	effW, effH := leftPadding+w+rightPadding, bottomPadding+h+topPadding
	collider.X, collider.Y, collider.W, collider.H = blX, blY, effW, effH
	rectShape := collider.Shape.(*resolv.ConvexPolygon)
	rectShape.UpdateAsRectangle(0, 0, effW, effH)
	collider.Data = data
	// Ignore "tag" for now
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
		BlState:         blState,
		FramesInBlState: framesInBlState,
		VirtualGridX:    virtualGridX,
		VirtualGridY:    virtualGridY,
		DirX:            dirX,
		DirY:            dirY,
		VelX:            velX,
		VelY:            velY,
		Speed:           speed,
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

func NewPlayerDownsync(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, framesToRecover, framesInChState, activeSkillId, activeSkillHit, framesInvinsible, speed, battleState, characterState, joinIndex, hp, maxHp, colliderRadius int32, inAir, onWall bool, onWallNormX, onWallNormY int32, capturedByInertia bool, bulletTeamId, chCollisionTeamId int32, revivalVirtualGridX, revivalVirtualGridY int32) *PlayerDownsync {
	return &PlayerDownsync{
		Id:                  id,
		VirtualGridX:        virtualGridX,
		VirtualGridY:        virtualGridY,
		DirX:                dirX,
		DirY:                dirY,
		VelX:                velX,
		VelY:                velY,
		FramesToRecover:     framesToRecover,
		FramesInChState:     framesInChState,
		ActiveSkillId:       activeSkillId,
		ActiveSkillHit:      activeSkillHit,
		FramesInvinsible:    framesInvinsible,
		Speed:               speed,
		BattleState:         battleState,
		CharacterState:      characterState,
		JoinIndex:           joinIndex,
		Hp:                  hp,
		MaxHp:               maxHp,
		ColliderRadius:      colliderRadius,
		InAir:               inAir,
		OnWall:              onWall,
		OnWallNormX:         onWallNormX,
		OnWallNormY:         onWallNormY,
		CapturedByInertia:   capturedByInertia,
		BulletTeamId:        bulletTeamId,
		ChCollisionTeamId:   chCollisionTeamId,
		RevivalVirtualGridX: revivalVirtualGridX,
		RevivalVirtualGridY: revivalVirtualGridY,
	}
}

func CloneMeleeBullet(blState, framesInBlState, bulletLocalId, originatedRenderFrameId, offenderJoinIndex, teamId int32, staticBulletConfig *BulletConfig, dst *MeleeBullet /* preallocated */) {
	dst.BlState = blState
	dst.FramesInBlState = framesInBlState
	dst.BattleAttr.BulletLocalId = bulletLocalId
	dst.BattleAttr.OriginatedRenderFrameId = originatedRenderFrameId
	dst.BattleAttr.OffenderJoinIndex = offenderJoinIndex
	dst.BattleAttr.TeamId = teamId
	dst.Bullet = staticBulletConfig // It's OK to just assign the pointer here, static bullet config is meant to be passed this way
}

func CloneFireballBullet(blState, framesInBlState, virtualGridX, virtualGridY, dirX, dirY, velX, velY, speed, bulletLocalId, originatedRenderFrameId, offenderJoinIndex, teamId int32, staticBulletConfig *BulletConfig, dst *FireballBullet /* preallocated */) {
	dst.BlState = blState
	dst.FramesInBlState = framesInBlState
	dst.VirtualGridX = virtualGridX
	dst.VirtualGridY = virtualGridY
	dst.DirX = dirX
	dst.DirY = dirY
	dst.VelX = velX
	dst.VelY = velY
	dst.Speed = speed
	dst.BattleAttr.BulletLocalId = bulletLocalId
	dst.BattleAttr.OriginatedRenderFrameId = originatedRenderFrameId
	dst.BattleAttr.OffenderJoinIndex = offenderJoinIndex
	dst.BattleAttr.TeamId = teamId
	dst.Bullet = staticBulletConfig // It's OK to just assign the pointer here, static bullet config is meant to be passed this way
}

func ClonePlayerDownsync(id, virtualGridX, virtualGridY, dirX, dirY, velX, velY, framesToRecover, framesInChState, activeSkillId, activeSkillHit, framesInvinsible, speed, battleState, characterState, joinIndex, hp, maxHp, colliderRadius int32, inAir, onWall bool, onWallNormX, onWallNormY int32, capturedByInertia bool, bulletTeamId, chCollisionTeamId, revivalVirtualGridX, revivalVirtualGridY int32, dst *PlayerDownsync) {
	dst.Id = id
	dst.VirtualGridX = virtualGridX
	dst.VirtualGridY = virtualGridY
	dst.DirX = dirX
	dst.DirY = dirY
	dst.VelX = velX
	dst.VelY = velY
	dst.FramesToRecover = framesToRecover
	dst.FramesInChState = framesInChState
	dst.ActiveSkillId = activeSkillId
	dst.ActiveSkillHit = activeSkillHit
	dst.FramesInvinsible = framesInvinsible
	dst.Speed = speed
	dst.BattleState = battleState
	dst.CharacterState = characterState
	dst.JoinIndex = joinIndex
	dst.Hp = hp
	dst.MaxHp = maxHp
	dst.ColliderRadius = colliderRadius
	dst.InAir = inAir
	dst.OnWall = onWall
	dst.OnWallNormX = onWallNormX
	dst.OnWallNormY = onWallNormY
	dst.CapturedByInertia = capturedByInertia
	dst.BulletTeamId = bulletTeamId
	dst.ChCollisionTeamId = chCollisionTeamId
	dst.RevivalVirtualGridX = revivalVirtualGridX
	dst.RevivalVirtualGridY = revivalVirtualGridY
}

func CloneRoomDownsyncFrame(id int32, playersArr []*PlayerDownsync, bulletLocalIdCounter int32, meleeBullets []*MeleeBullet, fireballBullets []*FireballBullet, dst *RoomDownsyncFrame) {
	dst.Id = id
	dst.BulletLocalIdCounter = bulletLocalIdCounter
	for i := 0; i < len(playersArr); i++ {
		src := playersArr[i]
		if nil == src || TERMINATING_PLAYER_ID == src.Id {
			break
		}
		ClonePlayerDownsync(src.Id, src.VirtualGridX, src.VirtualGridY, src.DirX, src.DirY, src.VelX, src.VelY, src.FramesToRecover, src.FramesInChState, src.ActiveSkillId, src.ActiveSkillHit, src.FramesInvinsible, src.Speed, src.BattleState, src.CharacterState, src.JoinIndex, src.Hp, src.MaxHp, src.ColliderRadius, src.InAir, src.OnWall, src.OnWallNormX, src.OnWallNormY, src.CapturedByInertia, src.BulletTeamId, src.ChCollisionTeamId, src.RevivalVirtualGridX, src.RevivalVirtualGridY, dst.PlayersArr[i])
	}

	for i := 0; i < len(meleeBullets); i++ {
		src := meleeBullets[i]
		if nil == src || TERMINATING_BULLET_LOCAL_ID == src.BattleAttr.BulletLocalId {
			break
		}
		CloneMeleeBullet(src.BlState, src.FramesInBlState, src.BattleAttr.BulletLocalId, src.BattleAttr.OriginatedRenderFrameId, src.BattleAttr.OffenderJoinIndex, src.BattleAttr.TeamId, src.Bullet, dst.MeleeBullets[i])
	}

	for i := 0; i < len(fireballBullets); i++ {
		src := fireballBullets[i]
		if nil == src || TERMINATING_BULLET_LOCAL_ID == src.BattleAttr.BulletLocalId {
			break
		}
		CloneFireballBullet(src.BlState, src.FramesInBlState, src.VirtualGridX, src.VirtualGridY, src.DirX, src.DirY, src.VelX, src.VelY, src.Speed, src.BattleAttr.BulletLocalId, src.BattleAttr.OriginatedRenderFrameId, src.BattleAttr.OffenderJoinIndex, src.BattleAttr.TeamId, src.Bullet, dst.FireballBullets[i])
	}
}

func NewPreallocatedRoomDownsyncFrame(roomCapacity, preallocMeleeBulletCount int, preallocFireballBulletCount int) *RoomDownsyncFrame {
	preallocatedPlayers := make([]*PlayerDownsync, roomCapacity)
	for i := 0; i < roomCapacity; i++ {
		preallocatedPlayer := NewPlayerDownsync(TERMINATING_PLAYER_ID, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, 0, 0, false, 0, 0, 0, 0)
		preallocatedPlayers[i] = preallocatedPlayer
	}

	preallocatedMeleeBullets := make([]*MeleeBullet, preallocMeleeBulletCount)
	for i := 0; i < preallocMeleeBulletCount; i++ {
		preallocatedMelee := NewMeleeBullet(TERMINATING_BULLET_LOCAL_ID, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0, 0, 0, 0, 0)
		preallocatedMeleeBullets[i] = preallocatedMelee
	}

	preallocatedFireballBullets := make([]*FireballBullet, preallocFireballBulletCount)
	for i := 0; i < preallocFireballBulletCount; i++ {
		preallocatedFireball := NewFireballBullet(TERMINATING_BULLET_LOCAL_ID, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
		preallocatedFireballBullets[i] = preallocatedFireball
	}

	return &RoomDownsyncFrame{
		Id:                   TERMINATING_RENDER_FRAME_ID,
		BulletLocalIdCounter: TERMINATING_BULLET_LOCAL_ID,
		PlayersArr:           preallocatedPlayers,
		MeleeBullets:         preallocatedMeleeBullets,
		FireballBullets:      preallocatedFireballBullets,
	}
}
