package models

import (
	. "dnmshared"
	. "dnmshared/sharedprotos"
	"github.com/solarlune/resolv"
	. "jsexport/protos"
)

const (
	COLLISION_PLAYER_INDEX_PREFIX  = (1 << 17)
	COLLISION_BARRIER_INDEX_PREFIX = (1 << 16)
	COLLISION_BULLET_INDEX_PREFIX  = (1 << 15)
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
	ATK_CHARACTER_STATE_IDLE1        = int32(0)
	ATK_CHARACTER_STATE_WALKING      = int32(1)
	ATK_CHARACTER_STATE_ATK1         = int32(2)
	ATK_CHARACTER_STATE_ATKED1       = int32(3)
	ATK_CHARACTER_STATE_INAIR_IDLE1  = int32(4)
	ATK_CHARACTER_STATE_INAIR_ATK1   = int32(5)
	ATK_CHARACTER_STATE_INAIR_ATKED1 = int32(6)
)

func ConvertToInputFrameId(renderFrameId int32, inputDelayFrames int32, inputScaleFrames int32) int32 {
	if renderFrameId < inputDelayFrames {
		return 0
	}
	return ((renderFrameId - inputDelayFrames) >> inputScaleFrames)
}

func DecodeInput(encodedInput uint64) *InputFrameDecoded {
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

func CalcHardPushbacksNorms(playerCollider *resolv.Object, playerShape *resolv.ConvexPolygon, snapIntoPlatformOverlap float64, pEffPushback *Vec2D) []Vec2D {
	ret := make([]Vec2D, 0, 10) // no one would simultaneously have more than 5 hardPushbacks
	collision := playerCollider.Check(0, 0)
	if nil == collision {
		return ret
	}
	for _, obj := range collision.Objects {
		switch obj.Data.(type) {
		case *Barrier:
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
		default:
		}
	}
	return ret
}

func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame, delayedInputFrameForPrevRenderFrame *InputFrameDownsync, currRenderFrame *RoomDownsyncFrame, collisionSys *resolv.Space, collisionSysMap map[int32]*resolv.Object, gravityX, gravityY, jumpingInitVelY, inputDelayFrames, inputScaleFrames int32, collisionSpaceOffsetX, collisionSpaceOffsetY, snapIntoPlatformOverlap, snapIntoPlatformThreshold, worldToVirtualGridRatio, virtualGridToWorldRatio float64) *RoomDownsyncFrame {
	topPadding, bottomPadding, leftPadding, rightPadding := snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap
	// [WARNING] This function MUST BE called while "InputsBufferLock" is locked!
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

	effPushbacks := make([]Vec2D, roomCapacity)
	hardPushbackNorms := make([][]Vec2D, roomCapacity)

	// 1. Process player inputs
	if nil != delayedInputFrame {
		inputList := delayedInputFrame.InputList
		for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
			joinIndex := currPlayerDownsync.JoinIndex
			thatPlayerInNextFrame := nextRenderFramePlayers[i]
			if 0 < thatPlayerInNextFrame.FramesToRecover {
				continue
			}
			decodedInput := DecodeInput(inputList[joinIndex-1])
			prevBtnBLevel := int32(0)
			if nil != delayedInputFrameForPrevRenderFrame {
				prevDecodedInput := DecodeInput(delayedInputFrameForPrevRenderFrame.InputList[joinIndex-1])
				prevBtnBLevel = prevDecodedInput.BtnBLevel
			}

			if decodedInput.BtnBLevel > prevBtnBLevel {
				characStateAlreadyInAir := false
				if ATK_CHARACTER_STATE_INAIR_IDLE1 == thatPlayerInNextFrame.CharacterState || ATK_CHARACTER_STATE_INAIR_ATK1 == thatPlayerInNextFrame.CharacterState || ATK_CHARACTER_STATE_INAIR_ATKED1 == thatPlayerInNextFrame.CharacterState {
					characStateAlreadyInAir = true
				}
				characStateIsInterruptWaivable := false
				if ATK_CHARACTER_STATE_IDLE1 == thatPlayerInNextFrame.CharacterState || ATK_CHARACTER_STATE_WALKING == thatPlayerInNextFrame.CharacterState || ATK_CHARACTER_STATE_INAIR_IDLE1 == thatPlayerInNextFrame.CharacterState {
					characStateIsInterruptWaivable = true
				}
				if !characStateAlreadyInAir && characStateIsInterruptWaivable {
					thatPlayerInNextFrame.VelY = jumpingInitVelY
				}
			}

			// Note that by now "0 == thatPlayerInNextFrame.FramesToRecover", we should change "CharacterState" to "WALKING" or "IDLE" depending on player inputs
			if 0 != decodedInput.Dx || 0 != decodedInput.Dy {
				thatPlayerInNextFrame.DirX = decodedInput.Dx
				thatPlayerInNextFrame.DirY = decodedInput.Dy
				thatPlayerInNextFrame.VelX = decodedInput.Dx * currPlayerDownsync.Speed
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_WALKING
			} else {
				thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
				thatPlayerInNextFrame.VelX = 0
			}
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
		if thatPlayerInNextFrame.VelY == jumpingInitVelY {
			newVy += thatPlayerInNextFrame.VelY
		}

		halfColliderWidth, halfColliderHeight := currPlayerDownsync.ColliderRadius, currPlayerDownsync.ColliderRadius+currPlayerDownsync.ColliderRadius // avoid multiplying
		playerCollider.X, playerCollider.Y = VirtualGridToPolygonColliderBLPos(newVx, newVy, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY, virtualGridToWorldRatio)
		// Update in the collision system
		playerCollider.Update()

		if currPlayerDownsync.InAir {
			thatPlayerInNextFrame.VelX += gravityX
			thatPlayerInNextFrame.VelY += gravityY
		}
	}

	// 3. Calc pushbacks for each player (after its movement) w/o bullets
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
		hardPushbackNorms[joinIndex-1] = CalcHardPushbacksNorms(playerCollider, playerShape, snapIntoPlatformOverlap, &(effPushbacks[joinIndex-1]))
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		fallStopping := false
		if collision := playerCollider.Check(0, 0); nil != collision {
			for _, obj := range collision.Objects {
				isBarrier, isAnotherPlayer, isBullet := false, false, false
				// TODO: Make this part work in JavaScript without having to expose all types Barrier/PlayerDownsync/MeleeBullet by js.MakeWrapper.
				switch obj.Data.(type) {
				case *Barrier:
					isBarrier = true
				case *PlayerDownsync:
					isAnotherPlayer = true
				case *MeleeBullet:
					isBullet = true
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
				landedOnGravityPushback := (snapIntoPlatformThreshold < normAlignmentWithGravity) // prevents false snapping on the lateral sides
				if landedOnGravityPushback {
					// kindly note that one player might land on top of another player, and snapping is also required in such case
					pushbackX, pushbackY = (overlapResult.Overlap-snapIntoPlatformOverlap)*overlapResult.OverlapX, (overlapResult.Overlap-snapIntoPlatformOverlap)*overlapResult.OverlapY
					thatPlayerInNextFrame.InAir = false
				}
				if isAnotherPlayer {
					// [WARNING] The "zero overlap collision" might be randomly detected/missed on either frontend or backend, to have deterministic result we added paddings to all sides of a playerCollider. As each velocity component of (velX, velY) being a multiple of 0.5 at any renderFrame, each position component of (x, y) can only be a multiple of 0.5 too, thus whenever a 1-dimensional collision happens between players from [player#1: i*0.5, player#2: j*0.5, not collided yet] to [player#1: (i+k)*0.5, player#2: j*0.5, collided], the overlap becomes (i+k-j)*0.5+2*s, and after snapping subtraction the effPushback magnitude for each player is (i+k-j)*0.5, resulting in 0.5-multiples-position for the next renderFrame.
					pushbackX, pushbackY = (overlapResult.Overlap-snapIntoPlatformOverlap*2)*overlapResult.OverlapX, (overlapResult.Overlap-snapIntoPlatformOverlap*2)*overlapResult.OverlapY
				}
				for _, hardPushbackNorm := range hardPushbackNorms[joinIndex-1] {
					projectedMagnitude := pushbackX*hardPushbackNorm.X + pushbackY*hardPushbackNorm.Y
					if isBarrier || (isAnotherPlayer && 0 > projectedMagnitude) {
						pushbackX -= projectedMagnitude * hardPushbackNorm.X
						pushbackY -= projectedMagnitude * hardPushbackNorm.Y
					}
				}
				effPushbacks[joinIndex-1].X += pushbackX
				effPushbacks[joinIndex-1].Y += pushbackY
				if currPlayerDownsync.InAir && landedOnGravityPushback {
					fallStopping = true
				}
			}
		}
		if fallStopping {
			thatPlayerInNextFrame.VelX = 0
			thatPlayerInNextFrame.VelY = 0
			thatPlayerInNextFrame.CharacterState = ATK_CHARACTER_STATE_IDLE1
			thatPlayerInNextFrame.FramesToRecover = 0
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

	// 4. Get players out of stuck barriers if there's any
	for i, currPlayerDownsync := range currRenderFrame.PlayersArr {
		joinIndex := currPlayerDownsync.JoinIndex
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		// Update "virtual grid position"
		thatPlayerInNextFrame := nextRenderFramePlayers[i]
		halfColliderWidth, halfColliderHeight := currPlayerDownsync.ColliderRadius, currPlayerDownsync.ColliderRadius+currPlayerDownsync.ColliderRadius // avoid multiplying
		thatPlayerInNextFrame.VirtualGridX, thatPlayerInNextFrame.VirtualGridY = PolygonColliderBLToVirtualGridPos(playerCollider.X-effPushbacks[joinIndex-1].X, playerCollider.Y-effPushbacks[joinIndex-1].Y, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY, worldToVirtualGridRatio)
	}

	return &RoomDownsyncFrame{
		Id:         currRenderFrame.Id + 1,
		PlayersArr: nextRenderFramePlayers,
	}
}
