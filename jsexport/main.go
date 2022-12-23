package main

import (
    "github.com/gopherjs/gopherjs/js"
	"github.com/solarlune/resolv"
    "dnmshared"
    . "dnmshared/sharedprotos"
    . "jsexport/protos"
    . "jsexport/models"
)

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
			overlapped, pushbackX, pushbackY, overlapResult := dnmshared.CalcPushbacks(0, 0, playerShape, barrierShape)
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

func NewRingBufferJs(n int32) *js.Object {
    return js.MakeWrapper(dnmshared.NewRingBuffer(n));
}

func NewCollisionSpaceJs(spaceW, spaceH, minStepW, minStepH int) *js.Object {
    return js.MakeWrapper(resolv.NewSpace(spaceW, spaceH, minStepW, minStepH))
}

func GenerateRectColliderJs(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64, tag string) *js.Object {
    /*
    [WARNING] It's important to note that we don't need "js.MakeFullWrapper" for a call sequence as follows. 
    ```
        var space = gopkgs.NewCollisionSpaceJs(2048, 2048, 8, 8);
        var a = gopkgs.GenerateRectColliderJs(189, 497, 48, 48, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, snapIntoPlatformOverlap, spaceOffsetX, spaceOffsetY, "Player");
        space.Add(a); 
    ```
    The "space" variable doesn't need access to the field of "a" in JavaScript level to run "space.Add(...)" method, which is good.
    */
    return js.MakeWrapper(dnmshared.GenerateRectCollider(wx, wy, w, h, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY, tag));

}

func CheckCollisionJs(obj *resolv.Object, dx, dy float64) *js.Object {
    // TODO: Support multiple tags in the future
    // Unfortunately I couldn't find a way to just call "var a = GenerateRectColliderJs(...); space.Add(a); a.Check(...)" to get the collision result, the unwrapped method will result in stack overflow. Need a better solution later.  
    return js.MakeFullWrapper(obj.Check(dx, dy));
}


/*
func ApplyInputFrameDownsyncDynamicsOnSingleRenderFrame(delayedInputFrame *InputFrameDownsync, currRenderFrame *RoomDownsyncFrame, collisionSysMap map[int32]*resolv.Object, topPadding, bottomPadding, leftPadding, rightPadding float64, roomCapacity int, jumpingInitVelY int32, playersArr []*Player, inputDelayFrames int32, inputScaleFrames int32, inputsBuffer *RingBuffer, collisionSpaceOffsetX, collisionSpaceOffsetY int32, snapIntoPlatformOverlap, worldToVirtualGridRatio, virtualGridToWorldRatio float64) *RoomDownsyncFrame {
	// [WARNING] This function MUST BE called while "InputsBufferLock" is locked!
	nextRenderFramePlayers := make(map[int32]*PlayerDownsync, roomCapacity)
	// Make a copy first
	for playerId, currPlayerDownsync := range currRenderFrame.Players {
		nextRenderFramePlayers[playerId] = &PlayerDownsync{
			Id:              playerId,
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
		if nextRenderFramePlayers[playerId].FramesToRecover < 0 {
			nextRenderFramePlayers[playerId].FramesToRecover = 0
		}
	}

	nextRenderFrameMeleeBullets := make([]*MeleeBullet, 0, len(currRenderFrame.MeleeBullets)) // Is there any better way to reduce malloc/free impact, e.g. smart prediction for fixed memory allocation?
	effPushbacks := make([]Vec2D, roomCapacity)
	hardPushbackNorms := make([][]Vec2D, roomCapacity)

	// 1. Process player inputs
	if nil != delayedInputFrame {
		var delayedInputFrameForPrevRenderFrame *InputFrameDownsync = nil
		tmp := inputsBuffer.GetByFrameId(ConvertToInputFrameId(currRenderFrame.Id-1, inputDelayFrames, inputScaleFrames))
		if nil != tmp {
			delayedInputFrameForPrevRenderFrame = tmp.(*InputFrameDownsync)
		}
		inputList := delayedInputFrame.InputList
		for _, player := range playersArr {
			playerId := player.Id
			joinIndex := player.JoinIndex
			currPlayerDownsync, thatPlayerInNextFrame := currRenderFrame.Players[playerId], nextRenderFramePlayers[playerId]
			if 0 < thatPlayerInNextFrame.FramesToRecover {
				continue
			}
			decodedInput := DecodeInput(inputList[joinIndex-1])
			prevBtnALevel, prevBtnBLevel := int32(0), int32(0)
			if nil != delayedInputFrameForPrevRenderFrame {
				prevDecodedInput := DecodeInput(delayedInputFrameForPrevRenderFrame.InputList[joinIndex-1])
				prevBtnALevel = prevDecodedInput.BtnALevel
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
	for _, player := range playersArr {
		playerId := player.Id
		joinIndex := player.JoinIndex
		effPushbacks[joinIndex-1].X, effPushbacks[joinIndex-1].Y = float64(0), float64(0)
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		currPlayerDownsync, thatPlayerInNextFrame := currRenderFrame.Players[playerId], nextRenderFramePlayers[playerId]
		// Reset playerCollider position from the "virtual grid position"
		newVx, newVy := currPlayerDownsync.VirtualGridX+currPlayerDownsync.VelX, currPlayerDownsync.VirtualGridY+currPlayerDownsync.VelY
		if thatPlayerInNextFrame.VelY == jumpingInitVelY {
			newVy += thatPlayerInNextFrame.VelY
		}

		halfColliderWidth, halfColliderHeight := player.ColliderRadius, player.ColliderRadius+player.ColliderRadius // avoid multiplying
		playerCollider.X, playerCollider.Y = VirtualGridToPolygonColliderBLPos(newVx, newVy, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY, virtualGridToWorldRatio)
		// Update in the collision system
		playerCollider.Update()

		if currPlayerDownsync.InAir {
			thatPlayerInNextFrame.VelX += gravityX
			thatPlayerInNextFrame.VelY += gravityY
		}
	}

	// 3. Invoke collision system stepping (no-op for backend collision lib)

	// 4. Calc pushbacks for each player (after its movement) w/o bullets
	for _, player := range playersArr {
		joinIndex := player.JoinIndex
		playerId := player.Id
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		playerShape := playerCollider.Shape.(*resolv.ConvexPolygon)
		hardPushbackNorms[joinIndex-1] = CalcHardPushbacksNorms(playerCollider, playerShape, snapIntoPlatformOverlap, &(effPushbacks[joinIndex-1]))
		currPlayerDownsync, thatPlayerInNextFrame := currRenderFrame.Players[playerId], nextRenderFramePlayers[playerId]
		fallStopping := false
		possiblyFallStoppedOnAnotherPlayer := false
		if collision := playerCollider.Check(0, 0); nil != collision {
			for _, obj := range collision.Objects {
				isBarrier, isAnotherPlayer, isBullet := false, false, false
				switch obj.Data.(type) {
				case *Barrier:
					isBarrier = true
				case *Player:
					isAnotherPlayer = true
				case *MeleeBullet:
					isBullet = true
				}
				if isBullet {
					// ignore bullets for this step
					continue
				}
				bShape := obj.Shape.(*resolv.ConvexPolygon)
				overlapped, pushbackX, pushbackY, overlapResult := dnmshared.CalcPushbacks(0, 0, playerShape, bShape)
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
					if isAnotherPlayer {
						possiblyFallStoppedOnAnotherPlayer = true
					}
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

	// 7. Get players out of stuck barriers if there's any
	for _, player := range playersArr {
		joinIndex := player.JoinIndex
		playerId := player.Id
		collisionPlayerIndex := COLLISION_PLAYER_INDEX_PREFIX + joinIndex
		playerCollider := collisionSysMap[collisionPlayerIndex]
		// Update "virtual grid position"
		currPlayerDownsync, thatPlayerInNextFrame := currRenderFrame.Players[playerId], nextRenderFramePlayers[playerId]
		halfColliderWidth, halfColliderHeight := player.ColliderRadius, player.ColliderRadius+player.ColliderRadius // avoid multiplying
		thatPlayerInNextFrame.VirtualGridX, thatPlayerInNextFrame.VirtualGridY = PolygonColliderBLToVirtualGridPos(playerCollider.X-effPushbacks[joinIndex-1].X, playerCollider.Y-effPushbacks[joinIndex-1].Y, halfColliderWidth, halfColliderHeight, topPadding, bottomPadding, leftPadding, rightPadding, collisionSpaceOffsetX, collisionSpaceOffsetY, worldToVirtualGridRatio)
	}

	return &RoomDownsyncFrame{
		Id:             currRenderFrame.Id + 1,
		Players:        nextRenderFramePlayers,
		MeleeBullets:   nextRenderFrameMeleeBullets,
		CountdownNanos: (BattleDurationNanos - int64(currRenderFrame.Id)*RollbackEstimatedDtNanos),
	}
}
*/

func main() {
	js.Global.Set("gopkgs", map[string]interface{}{
        "NewRingBufferJs": NewRingBufferJs,
        "NewCollisionSpaceJs": NewCollisionSpaceJs,
        "GenerateRectColliderJs": GenerateRectColliderJs,
        "CheckCollisionJs": CheckCollisionJs,
	})
}
