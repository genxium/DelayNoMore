package main

import (
	. "dnmshared"
	. "dnmshared/sharedprotos"
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

	playerDefaultSpeed := int32(10)
    minStep := int(playerDefaultSpeed)
	playerColliderRadius := float64(12)
	playerColliders := make([]*resolv.Object, len(playerPosList.Eles))
	space := resolv.NewSpace(int(spaceW), int(spaceH), minStep, minStep)
	for i, playerPos := range playerPosList.Eles {
		playerCollider := GenerateRectCollider(playerPos.X, playerPos.Y, playerColliderRadius*2, playerColliderRadius*2, spaceOffsetX, spaceOffsetY, "Player") // [WARNING] Deliberately not using a circle because "resolv v0.5.1" doesn't yet align circle center with space cell center, regardless of the "specified within-object offset"
		Logger.Info(fmt.Sprintf("Player Collider#%d: playerPos.X=%v, playerPos.Y=%v, radius=%v, spaceOffsetX=%v, spaceOffsetY=%v, shape=%v", i, playerPos.X, playerPos.Y, playerColliderRadius, spaceOffsetX, spaceOffsetY, playerCollider.Shape))
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
		effPushback := Vec2D{X: float64(0), Y: float64(0)}
		toTestPlayerCollider := playerColliders[0]
		toTestPlayerCollider.X += -50.0
		toTestPlayerCollider.Y += -60.0
		toTestPlayerCollider.Update()
		oldDx, oldDy := float64(0), float64(0)
		if collision := toTestPlayerCollider.Check(oldDx, oldDy); collision != nil {
			playerShape := toTestPlayerCollider.Shape.(*resolv.ConvexPolygon)
			for _, obj := range collision.Objects {
				barrierShape := obj.Shape.(*resolv.ConvexPolygon)
				if overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(oldDx, oldDy, playerShape, barrierShape); overlapped {
					Logger.Info(fmt.Sprintf("Overlapped: a=%v, b=%v, pushbackX=%v, pushbackY=%v", ConvexPolygonStr(playerShape), ConvexPolygonStr(barrierShape), pushbackX, pushbackY))
					effPushback.X += pushbackX
					effPushback.Y += pushbackY
				} else {
					Logger.Info(fmt.Sprintf("Collided BUT not overlapped: a=%v, b=%v, overlapResult=%v", ConvexPolygonStr(playerShape), ConvexPolygonStr(barrierShape), overlapResult))
				}
			}
			toTestPlayerCollider.X -= effPushback.X
			toTestPlayerCollider.Y -= effPushback.Y
			toTestPlayerCollider.Update()
			Logger.Info(fmt.Sprintf("effPushback={%v, %v}", effPushback.X, effPushback.Y))
		}
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
