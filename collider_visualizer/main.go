package main

import (
	_ "embed"
	"fmt"
	"image/color"

	"go.uber.org/zap"

	"github.com/golang/freetype/truetype"
	"github.com/hajimehoshi/ebiten/v2"
	"github.com/hajimehoshi/ebiten/v2/ebitenutil"
	"github.com/hajimehoshi/ebiten/v2/text"
	"github.com/solarlune/resolv"
	"golang.org/x/image/font"

	"encoding/xml"
	"io/ioutil"
	"os"
	"path/filepath"

	. "dnmshared"
)

func parseStage(stageName string) (int32, int32, int32, int32, StrToVec2DListMap, StrToPolygon2DListMap, error) {
	pwd, err := os.Getwd()
	if nil != err {
		Logger.Error("Failed to get current working dir:", zap.Any("pwd", pwd), zap.Any("err", err))
	}

	relativePathForAllStages := "../frontend/assets/resources/map"
	relativePathForChosenStage := fmt.Sprintf("%s/%s", relativePathForAllStages, stageName)

	pTmxMapIns := &TmxMap{}

	absDirPathContainingDirectlyTmxFile := filepath.Join(pwd, relativePathForChosenStage)
	absTmxFilePath := fmt.Sprintf("%s/map.tmx", absDirPathContainingDirectlyTmxFile)
	if !filepath.IsAbs(absTmxFilePath) {
		panic("Tmx filepath must be absolute!")
	}

	byteArr, err := ioutil.ReadFile(absTmxFilePath)
	if nil != err {
		panic(err)
	}
	err = xml.Unmarshal(byteArr, pTmxMapIns)
	if nil != err {
		panic(err)
	}

	// Obtain the content of `gidBoundariesMapInB2World`.
	gidBoundariesMapInB2World := make(map[int]StrToPolygon2DListMap, 0)
	for _, tileset := range pTmxMapIns.Tilesets {
		relativeTsxFilePath := fmt.Sprintf("%s/%s", filepath.Join(pwd, relativePathForChosenStage), tileset.Source) // Note that "TmxTileset.Source" can be a string of "relative path".
		absTsxFilePath, err := filepath.Abs(relativeTsxFilePath)
		if nil != err {
			panic(err)
		}
		if !filepath.IsAbs(absTsxFilePath) {
			panic("Filepath must be absolute!")
		}

		byteArrOfTsxFile, err := ioutil.ReadFile(absTsxFilePath)
		if nil != err {
			panic(err)
		}

		DeserializeTsxToColliderDict(pTmxMapIns, byteArrOfTsxFile, int(tileset.FirstGid), gidBoundariesMapInB2World)
	}

	return ParseTmxLayersAndGroups(pTmxMapIns, gidBoundariesMapInB2World)
}

//go:embed excel.ttf
var excelFont []byte

type Game struct {
	World         WorldInterface
	Width, Height int
	Debug         bool
	ShowHelpText  bool
	Screen        *ebiten.Image
	FontFace      font.Face
}

func NewGame() *Game {

	// stageName := "simple" // Use this for calibration
	// stageName := "richsoil"
	stageName := "dungeon"
	stageDiscreteW, stageDiscreteH, stageTileW, stageTileH, playerPosMap, barrierMap, err := parseStage(stageName)
	if nil != err {
		panic(err)
	}
	PolygonFillerImage.Fill(color.RGBA{60, 60, 60, 255}) // Required to init color of the polygons!

	spaceW := stageDiscreteW * stageTileW
	spaceH := stageDiscreteH * stageTileH

	ebiten.SetWindowResizable(true)
	ebiten.SetWindowTitle("resolv test")

	g := &Game{
		Width:        int(spaceW),
		Height:       int(spaceH),
		ShowHelpText: true,
	}

	g.World = NewWorldColliderDisplay(g, stageDiscreteW, stageDiscreteH, stageTileW, stageTileH, playerPosMap, barrierMap)

	fontData, _ := truetype.Parse(excelFont)

	g.FontFace = truetype.NewFace(fontData, &truetype.Options{Size: 10})

	return g
}

func (g *Game) Update() error {
	g.World.Update()
	return nil
}

func (g *Game) Draw(screen *ebiten.Image) {
	g.Screen = screen
	screen.Fill(color.RGBA{20, 20, 40, 255})
	g.World.Draw(screen)
}

func (g *Game) DrawText(screen *ebiten.Image, x, y int, textLines ...string) {
	rectHeight := 10
	for _, txt := range textLines {
		w := float64(font.MeasureString(g.FontFace, txt).Round())
		ebitenutil.DrawRect(screen, float64(x), float64(y-8), w, float64(rectHeight), color.RGBA{0, 0, 0, 192})

		text.Draw(screen, txt, g.FontFace, x+1, y+1, color.RGBA{0, 0, 150, 255})
		text.Draw(screen, txt, g.FontFace, x, y, color.RGBA{100, 150, 255, 255})
		y += rectHeight
	}
}

func (g *Game) DebugDraw(screen *ebiten.Image, space *resolv.Space) {

	for y := 0; y < space.Height(); y++ {
		for x := 0; x < space.Width(); x++ {
			cell := space.Cell(x, y)

			cw := float64(space.CellWidth)
			ch := float64(space.CellHeight)
			cx := float64(cell.X) * cw
			cy := float64(cell.Y) * ch

			drawColor := color.RGBA{20, 20, 20, 255}

			if cell.Occupied() {
				drawColor = color.RGBA{255, 255, 0, 255}
			}

			ebitenutil.DrawLine(screen, cx, cy, cx+cw, cy, drawColor)
			ebitenutil.DrawLine(screen, cx+cw, cy, cx+cw, cy+ch, drawColor)
			ebitenutil.DrawLine(screen, cx+cw, cy+ch, cx, cy+ch, drawColor)
			ebitenutil.DrawLine(screen, cx, cy+ch, cx, cy, drawColor)
		}
	}
}

func (g *Game) Layout(w, h int) (int, int) {
	return g.Width, g.Height
}

func main() {
	ebiten.RunGame(NewGame())
}
