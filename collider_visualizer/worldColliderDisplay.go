package main

import (
	"fmt"
	"image/color"
	"go.uber.org/zap"
	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/ebitenutil"
	"github.com/solarlune/resolv"
    . "dnmshared"

    "math"
)

type WorldColliderDisplay struct {
	Game   *Game
	Space  *resolv.Space
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

	playerColliderRadius := float64(12) // hardcoded
	space := resolv.NewSpace(int(spaceW), int(spaceH), int(stageTileW), int(stageTileH))
    for _, player := range playerList {
        playerCollider := resolv.NewObject(player.X+spaceOffsetX, player.Y+spaceOffsetY, playerColliderRadius*2, playerColliderRadius*2, "Player")
        playerColliderShape := resolv.NewCircle(0, 0, playerColliderRadius*2)
        playerCollider.SetShape(playerColliderShape)
	    Logger.Info("player shape added:", zap.Any("shape", playerColliderShape))
        space.Add(playerCollider)
    }


    barrierLocalId := 0
    for _, barrier := range barrierList {
        var w float64 = 0
        var h float64 = 0

        for i, pi := range barrier.Points {
            for j, pj := range barrier.Points {
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

        barrierColliderShape := resolv.NewConvexPolygon()
        for i := len(barrier.Points)-1; i >= 0; i-- {
            p := barrier.Points[i]
            barrierColliderShape.AddPoints(p.X, p.Y)
        }

        barrierCollider := resolv.NewObject(barrier.Anchor.X+spaceOffsetX, barrier.Anchor.Y+spaceOffsetY, w, h, "Barrier")
        barrierCollider.SetShape(barrierColliderShape)

	    Logger.Info("barrier shape added:", zap.Any("barrierLocalId", barrierLocalId), zap.Any("shape", barrierColliderShape))
        space.Add(barrierCollider)

        barrierLocalId++
    }

	world.Space = space
    return world
}

func (world *WorldColliderDisplay) Update() {

}

func (world *WorldColliderDisplay) Draw(screen *ebiten.Image) {

	for _, o := range world.Space.Objects() {
		drawColor := color.RGBA{60, 60, 60, 255}
		if o.HasTags("Player") {
			drawColor = color.RGBA{0, 255, 0, 255}
		}
		ebitenutil.DrawRect(screen, o.X, o.Y, o.W, o.H, drawColor)
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
