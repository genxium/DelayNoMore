package main

import (
	. "dnmshared"
	"fmt"
	"github.com/hajimehoshi/ebiten/v2"
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
        oldDx := 0.0
        oldDy := 180.0
        dx := oldDx
        dy := oldDy
        if collision := toTestPlayerCollider.Check(oldDx, oldDy, "Barrier"); collision != nil {
            playerShape := toTestPlayerCollider.Shape.(*resolv.ConvexPolygon)
            barrierShape := collision.Objects[0].Shape.(*resolv.ConvexPolygon)
            origX, origY := playerShape.Position() 
            playerShape.SetPosition(origX+oldDx, origY+oldDy)
            if mtv := CalculateMTVForConvexPolygon(playerShape, barrierShape); mtv != nil {
                Logger.Info(fmt.Sprintf("Collided: shape=%v, oldDx=%v, oldDy=%v, MTV=%v", toTestPlayerCollider.Shape, oldDx, oldDy, mtv))
                //dx, dy = mtv[0], mtv[1]
            } else {
                Logger.Info(fmt.Sprintf("Collided: shape=%v, oldDx=%v, oldDy=%v, toCheckBarrier=%v, not intersecting", toTestPlayerCollider.Shape, oldDx, oldDy, barrierShape))
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
