package main

import (
	"github.com/hajimehoshi/ebiten/v2"
	"github.com/solarlune/resolv"
	"image/color"
)

var (
	PolygonFillerImage = ebiten.NewImage(1, 1)
)

func DrawPolygon(screen *ebiten.Image, shape *resolv.ConvexPolygon, clr color.Color) {
	PolygonFillerImage.Fill(clr)
	indices := []uint16{}
	vs := []ebiten.Vertex{}
	coors := shape.Transformed()
	centerX := float64(0)
	centerY := float64(0)
	n := uint16(len(coors))
	for i, coor := range coors {
		centerX += coor.X()
		centerY += coor.Y()
		vs = append(vs, ebiten.Vertex{
			DstX:   float32(coor.X()),
			DstY:   float32(coor.Y()),
			SrcX:   0,
			SrcY:   0,
			ColorR: 1,
			ColorG: 1,
			ColorB: 1,
			ColorA: 1,
		})
		indices = append(indices, uint16(i), uint16(i+1)%n, n)
	}

	centerX = centerX / float64(n)
	centerY = centerY / float64(n)

	vs = append(vs, ebiten.Vertex{
		DstX:   float32(centerX),
		DstY:   float32(centerY),
		SrcX:   0,
		SrcY:   0,
		ColorR: 1,
		ColorG: 1,
		ColorB: 1,
		ColorA: 1,
	})

	screen.DrawTriangles(vs, indices, PolygonFillerImage, nil)
}
