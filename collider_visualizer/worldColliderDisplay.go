package main

import (
	. "battle_srv/protos"
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

	worldToVirtualGridRatio := float64(1000)
	virtualGridToWorldRatio := float64(1)/worldToVirtualGridRatio
	playerDefaultSpeed := 1 * worldToVirtualGridRatio
	minStep := (int(float64(playerDefaultSpeed)*virtualGridToWorldRatio) << 2)
	playerColliderRadius := float64(12)
	playerColliders := make([]*resolv.Object, len(playerPosList.Eles))
	space := resolv.NewSpace(int(spaceW), int(spaceH), minStep, minStep)
	for i, playerPos := range playerPosList.Eles {
		playerCollider := GenerateRectCollider(playerPos.X, playerPos.Y, playerColliderRadius*2, playerColliderRadius*4, spaceOffsetX, spaceOffsetY, "Player") // [WARNING] Deliberately not using a circle because "resolv v0.5.1" doesn't yet align circle center with space cell center, regardless of the "specified within-object offset"
		Logger.Info(fmt.Sprintf("Player Collider#%d: player world pos =(%.2f, %.2f), shape=%v", i, playerPos.X, playerPos.Y, ConvexPolygonStr(playerCollider.Shape.(*resolv.ConvexPolygon))))
		playerColliders[i] = playerCollider
		space.Add(playerCollider)
	}

	barrierLocalId := 0
	for _, barrierUnaligned := range barrierList.Eles {
		barrierCollider := GenerateConvexPolygonCollider(barrierUnaligned, spaceOffsetX, spaceOffsetY, "Barrier")
		Logger.Debug(fmt.Sprintf("Added barrier: shape=%v", ConvexPolygonStr(barrierCollider.Shape.(*resolv.ConvexPolygon))))
		space.Add(barrierCollider)
		barrierLocalId++
	}

	world.Space = space

	moveToCollide := true
	if moveToCollide {
		effPushback := Vec2D{X: float64(0), Y: float64(0)}
		toTestPlayerCollider := playerColliders[0]
		newVx, newVy := int32(43900), int32(-451350)
		toTestPlayerCollider.X, toTestPlayerCollider.Y = VirtualGridToPolygonColliderAnchorPos(newVx, newVy, playerColliderRadius, playerColliderRadius, spaceOffsetX, spaceOffsetY, virtualGridToWorldRatio)

		Logger.Info(fmt.Sprintf("Checking collision for playerShape=%v", ConvexPolygonStr(toTestPlayerCollider.Shape.(*resolv.ConvexPolygon))))

		toTestPlayerCollider.Update()
		if collision := toTestPlayerCollider.Check(0, 0); collision != nil {
			playerShape := toTestPlayerCollider.Shape.(*resolv.ConvexPolygon)
			for _, obj := range collision.Objects {
				bShape := obj.Shape.(*resolv.ConvexPolygon)
			    Logger.Warn(fmt.Sprintf("Checking potential: a=%v, b=%v", ConvexPolygonStr(playerShape), ConvexPolygonStr(bShape)))
				if overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(0, 0, playerShape, bShape); overlapped {
					Logger.Warn(fmt.Sprintf("Overlapped: a=%v, b=%v, pushbackX=%v, pushbackY=%v", ConvexPolygonStr(playerShape), ConvexPolygonStr(bShape), pushbackX, pushbackY))
					effPushback.X += pushbackX
					effPushback.Y += pushbackY
				} else {
					Logger.Warn(fmt.Sprintf("Collided BUT not overlapped: a=%v, b=%v, overlapResult=%v", ConvexPolygonStr(playerShape), ConvexPolygonStr(bShape), overlapResult))
				}
			}
			toTestPlayerCollider.X -= effPushback.X
			toTestPlayerCollider.Y -= effPushback.Y
			toTestPlayerCollider.Update()
			Logger.Info(fmt.Sprintf("effPushback={%v, %v}", effPushback.X, effPushback.Y))
		}
	}
	meleeBullet := &MeleeBullet{
		// for offender
		StartupFrames:         int32(18),
		ActiveFrames:          int32(1),
		RecoveryFrames:        int32(61),
		RecoveryFramesOnBlock: int32(61),
		RecoveryFramesOnHit:   int32(61),
		Moveforward: &Vec2D{
			X: 0,
			Y: 0,
		},
		HitboxOffset: float64(24.0),
		HitboxSize: &Vec2D{
			X: float64(45.0),
			Y: float64(32.0),
		},

		// for defender
		HitStunFrames:      int32(18),
		BlockStunFrames:    int32(9),
		Pushback:           float64(22.0),
		ReleaseTriggerType: int32(1), // 1: rising-edge, 2: falling-edge
		Damage:             int32(5),
	}
	bulletLeftToRight := false
	if bulletLeftToRight {
		xfac := float64(1.0)
		offenderWx, offenderWy := playerPosList.Eles[0].X, playerPosList.Eles[0].Y
		bulletWx, bulletWy := offenderWx+xfac*meleeBullet.HitboxOffset, offenderWy

		newBulletCollider := GenerateRectCollider(bulletWx, bulletWy, meleeBullet.HitboxSize.X, meleeBullet.HitboxSize.Y, spaceOffsetX, spaceOffsetY, "MeleeBullet")
		space.Add(newBulletCollider)
		bulletShape := newBulletCollider.Shape.(*resolv.ConvexPolygon)
		Logger.Warn(fmt.Sprintf("bullet ->: Added bullet collider to space: a=%v", ConvexPolygonStr(bulletShape)))

		if collision := newBulletCollider.Check(0, 0); collision != nil {
			for _, obj := range collision.Objects {
				objShape := obj.Shape.(*resolv.ConvexPolygon)
				if overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(0, 0, bulletShape, objShape); overlapped {
					Logger.Warn(fmt.Sprintf("bullet ->: Overlapped: a=%v, b=%v, pushbackX=%v, pushbackY=%v", ConvexPolygonStr(bulletShape), ConvexPolygonStr(objShape), pushbackX, pushbackY))
				} else {
					Logger.Warn(fmt.Sprintf("bullet ->: Collided BUT not overlapped: a=%v, b=%v, overlapResult=%v", ConvexPolygonStr(bulletShape), ConvexPolygonStr(objShape), overlapResult))
				}
			}
		}
	}

	bulletRightToLeft := false
	if bulletRightToLeft {
		xfac := float64(-1.0)
		offenderWx, offenderWy := playerPosList.Eles[1].X, playerPosList.Eles[1].Y
		bulletWx, bulletWy := offenderWx+xfac*meleeBullet.HitboxOffset, offenderWy

		newBulletCollider := GenerateRectCollider(bulletWx, bulletWy, meleeBullet.HitboxSize.X, meleeBullet.HitboxSize.Y, spaceOffsetX, spaceOffsetY, "MeleeBullet")
		space.Add(newBulletCollider)
		bulletShape := newBulletCollider.Shape.(*resolv.ConvexPolygon)
		Logger.Warn(fmt.Sprintf("bullet <-: Added bullet collider to space: a=%v", ConvexPolygonStr(bulletShape)))

		if collision := newBulletCollider.Check(0, 0); collision != nil {
			for _, obj := range collision.Objects {
				objShape := obj.Shape.(*resolv.ConvexPolygon)
				if overlapped, pushbackX, pushbackY, overlapResult := CalcPushbacks(0, 0, bulletShape, objShape); overlapped {
					Logger.Warn(fmt.Sprintf("bullet <-: Overlapped: a=%v, b=%v, pushbackX=%v, pushbackY=%v", ConvexPolygonStr(bulletShape), ConvexPolygonStr(objShape), pushbackX, pushbackY))
				} else {
					Logger.Warn(fmt.Sprintf("bullet <-: Collided BUT not overlapped: a=%v, b=%v, overlapResult=%v", ConvexPolygonStr(bulletShape), ConvexPolygonStr(objShape), overlapResult))
				}
			}
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
		} else if o.HasTags("MeleeBullet") {
			drawColor := color.RGBA{0, 0, 255, 255}
			DrawPolygon(screen, o.Shape.(*resolv.ConvexPolygon), drawColor)
		} else {
			drawColor := color.RGBA{60, 60, 60, 255}
			DrawPolygon(screen, o.Shape.(*resolv.ConvexPolygon), drawColor)
		}
	}

	//world.Game.DebugDraw(screen, world.Space)

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
