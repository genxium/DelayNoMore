package main

import (
	. "dnmshared"
	"fmt"
	"github.com/hajimehoshi/ebiten/v2"
	"github.com/kvartborg/vector"
	"github.com/solarlune/resolv"
	"go.uber.org/zap"
	"image/color"
)

type WorldColliderDisplay struct {
	Game  *Game
	Space *resolv.Space
}

func (world *WorldColliderDisplay) Init() {
}

func NewWorldColliderDisplay(game *Game, stageDiscreteW, stageDiscreteH, stageTileW, stageTileH int32, playerPosMap StrToVec2DListMap, barrierMap StrToPolygon2DListMap) *WorldColliderDisplay {

	playerList := *(playerPosMap["PlayerStartingPos"])
	barrierList := *(barrierMap["Barrier"])

	world := &WorldColliderDisplay{Game: game}

	Logger.Info("Parsed variables", zap.Any("stageDiscreteW", stageDiscreteW), zap.Any("stageDiscreteH", stageDiscreteH), zap.Any("stageTileW", stageTileW), zap.Any("stageTileH", stageTileH))

	spaceW := stageDiscreteW * stageTileW
	spaceH := stageDiscreteH * stageTileH

	spaceOffsetX := float64(spaceW) * 0.5
	spaceOffsetY := float64(spaceH) * 0.5

	playerColliderRadius := float64(32)
    playerColliders := make([]*resolv.Object, len(playerList))
	space := resolv.NewSpace(int(spaceW), int(spaceH), 16, 16)
	for i, player := range playerList {
		playerCollider := GenerateRectCollider(player.X, player.Y, playerColliderRadius*2, playerColliderRadius*2, spaceOffsetX, spaceOffsetY, "Player") // [WARNING] Deliberately not using a circle because "resolv v0.5.1" doesn't yet align circle center with space cell center, regardless of the "specified within-object offset"
        Logger.Info(fmt.Sprintf("Player Collider#%d: player.X=%v, player.Y=%v, radius=%v, spaceOffsetX=%v, spaceOffsetY=%v, shape=%v; calibrationCheckX=player.X-radius+spaceOffsetX=%v", i, player.X, player.Y, playerColliderRadius, spaceOffsetX, spaceOffsetY, playerCollider.Shape, player.X-playerColliderRadius+spaceOffsetX))
        playerColliders[i] = playerCollider
		space.Add(playerCollider)
	}

	barrierLocalId := 0
	for _, barrierUnaligned := range barrierList {
		barrierCollider := GenerateConvexPolygonCollider(barrierUnaligned, spaceOffsetX, spaceOffsetY, "Barrier")
        Logger.Info(fmt.Sprintf("Added barrier: shape=%v", barrierCollider.Shape))
		space.Add(barrierCollider)
		barrierLocalId++
	}

	world.Space = space

    moveToCollide := true 
    if moveToCollide {
        toTestPlayerCollider := playerColliders[0] 
        oldDx, oldDy := 135.0, 135.0
        dx, dy := oldDx, oldDy
        if collision := toTestPlayerCollider.Check(oldDx, oldDy, "Barrier"); collision != nil {
            playerShape := toTestPlayerCollider.Shape.(*resolv.ConvexPolygon)
            barrierShape := collision.Objects[0].Shape.(*resolv.ConvexPolygon)
            origX, origY := playerShape.Position() 
            playerShape.SetPosition(origX+oldDx, origY+oldDy)
            if colliding := IsPolygonPairColliding(playerShape, barrierShape, nil); colliding {
                Logger.Info(fmt.Sprintf("Collided: playerShape=%v, oldDx=%v, oldDy=%v", playerShape, oldDx, oldDy))
                overlapResult := &SatResult{
                    Overlap: 0,
                    OverlapX: 0, 
                    OverlapY: 0, 
                    AContainedInB: true,
                    BContainedInA: true,
                    Axis: vector.Vector{0, 0},
                }
                e := vector.Vector{oldDx, oldDy}.Unit()
                if separatableAlongMovement := IsPolygonPairSeparatedByDir(playerShape, barrierShape, e, overlapResult); !separatableAlongMovement {
                    pushbackX, pushbackY := overlapResult.Overlap*overlapResult.OverlapX, overlapResult.Overlap*overlapResult.OverlapY  
                    Logger.Info(fmt.Sprintf("Collided: playerShape=%v, oldDx=%v, oldDy=%v, toCheckBarrier=%v, pushbackX=%v, pushbackY=%v", playerShape, oldDx, oldDy, barrierShape, pushbackX, pushbackY))
                    dx, dy = oldDx-pushbackX, oldDy-pushbackY 
                } else {
                    Logger.Info(fmt.Sprintf("Not Collided: playerShape=%v, oldDx=%v, oldDy=%v, toCheckBarrier=%v, e=%v", playerShape, oldDx, oldDy, barrierShape, e))
                }
            } else {
                Logger.Info(fmt.Sprintf("Not collided: playerShape=%v, oldDx=%v, oldDy=%v, toCheckBarrier=%v", playerShape, oldDx, oldDy, barrierShape))
            }  

            playerShape.SetPosition(origX, origY)

            toTestPlayerCollider.X += dx
            toTestPlayerCollider.Y += dy
        } else {
            Logger.Info(fmt.Sprintf("Collision Test: shape=%v, oldDx=%v, oldDy=%v, not colliding with any Barrier", toTestPlayerCollider.Shape, oldDx, oldDy))
        }

        toTestPlayerCollider.Update()
    } 

	return world
}

func (world *WorldColliderDisplay) Update() {

}

func (world *WorldColliderDisplay) Draw(screen *ebiten.Image) {

	for _, o := range world.Space.Objects() {
		if o.HasTags("Player") {
			drawColor := color.RGBA{0, 255, 0, 255}
			DrawPolygon(screen, o.Shape.(*resolv.ConvexPolygon), drawColor)
		} else {
			drawColor := color.RGBA{60, 60, 60, 255}
			DrawPolygon(screen, o.Shape.(*resolv.ConvexPolygon), drawColor)
		}
	}

	world.Game.DebugDraw(screen, world.Space)

	if world.Game.ShowHelpText {

		world.Game.DrawText(screen, 16, 16,
			"~ Collider Display test ~",
			"F1: Toggle Debug View",
			"F2: Show / Hide help text",
			"R: Restart world",
			fmt.Sprintf("%d FPS (frames per second)", int(ebiten.CurrentFPS())),
			fmt.Sprintf("%d TPS (ticks per second)", int(ebiten.CurrentTPS())),
		)

	}

}
