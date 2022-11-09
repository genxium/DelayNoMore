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

	playerPosList := *(playerPosMap["PlayerStartingPos"])
	barrierList := *(barrierMap["Barrier"])

	world := &WorldColliderDisplay{Game: game}

	Logger.Info("Parsed variables", zap.Any("stageDiscreteW", stageDiscreteW), zap.Any("stageDiscreteH", stageDiscreteH), zap.Any("stageTileW", stageTileW), zap.Any("stageTileH", stageTileH))

	spaceW := stageDiscreteW * stageTileW
	spaceH := stageDiscreteH * stageTileH

	spaceOffsetX := float64(spaceW) * 0.5
	spaceOffsetY := float64(spaceH) * 0.5

	playerColliderRadius := float64(32)
	playerColliders := make([]*resolv.Object, len(playerPosList.Eles))
	space := resolv.NewSpace(int(spaceW), int(spaceH), 16, 16)
	for i, playerPos := range playerPosList.Eles {
		playerCollider := GenerateRectCollider(playerPos.X, playerPos.Y, playerColliderRadius*2, playerColliderRadius*2, spaceOffsetX, spaceOffsetY, "Player") // [WARNING] Deliberately not using a circle because "resolv v0.5.1" doesn't yet align circle center with space cell center, regardless of the "specified within-object offset"
		Logger.Info(fmt.Sprintf("Player Collider#%d: playerPos.X=%v, playerPos.Y=%v, radius=%v, spaceOffsetX=%v, spaceOffsetY=%v, shape=%v; calibrationCheckX=playerPos.X-radius+spaceOffsetX=%v", i, playerPos.X, playerPos.Y, playerColliderRadius, spaceOffsetX, spaceOffsetY, playerCollider.Shape, playerPos.X-playerColliderRadius+spaceOffsetX))
		playerColliders[i] = playerCollider
		space.Add(playerCollider)
	}

	barrierLocalId := 0
	for _, barrierUnaligned := range barrierList.Eles {
		barrierCollider := GenerateConvexPolygonCollider(barrierUnaligned, spaceOffsetX, spaceOffsetY, "Barrier")
		Logger.Info(fmt.Sprintf("Added barrier: shape=%v", barrierCollider.Shape))
		space.Add(barrierCollider)
		barrierLocalId++
	}

	world.Space = space

	moveToCollide := true
	if moveToCollide {
		toTestPlayerCollider := playerColliders[0]
		oldDx, oldDy := -2.98, -50.0
		dx, dy := oldDx, oldDy
		if collision := toTestPlayerCollider.Check(oldDx, oldDy, "Barrier"); collision != nil {
			playerShape := toTestPlayerCollider.Shape.(*resolv.ConvexPolygon)
			barrierShape := collision.Objects[0].Shape.(*resolv.ConvexPolygon)
			if overlapped, pushbackX, pushbackY := CalcPushbacks(oldDx, oldDy, playerShape, barrierShape); overlapped {
				Logger.Info(fmt.Sprintf("Collided & overlapped: player.X=%v, player.Y=%v, oldDx=%v, oldDy=%v, playerShape=%v, toCheckBarrier=%v, pushbackX=%v, pushbackY=%v", toTestPlayerCollider.X, toTestPlayerCollider.Y, oldDx, oldDy, ConvexPolygonStr(playerShape), ConvexPolygonStr(barrierShape), pushbackX, pushbackY))
				dx -= pushbackX
				dy -= pushbackY
			} else {
				Logger.Info(fmt.Sprintf("Collider BUT not overlapped: player.X=%v, player.Y=%v, oldDx=%v, oldDy=%v, playerShape=%v, toCheckBarrier=%v", toTestPlayerCollider.X, toTestPlayerCollider.Y, oldDx, oldDy, ConvexPolygonStr(playerShape), ConvexPolygonStr(barrierShape)))
			}
		}

		toTestPlayerCollider.X += dx
		toTestPlayerCollider.Y += dy
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
