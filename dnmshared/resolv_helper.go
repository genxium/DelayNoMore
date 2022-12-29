package dnmshared

import (
	"fmt"
	. "jsexport/battle"
	"resolv"
	"strings"
)

func NormVec2D(dx, dy float64) Vec2D {
	return Vec2D{X: dy, Y: -dx}
}

func ConvexPolygonStr(body *resolv.ConvexPolygon) string {
	var s []string = make([]string, len(body.Points))
	for i, p := range body.Points {
		s[i] = fmt.Sprintf("[%.2f, %.2f]", p[0]+body.X, p[1]+body.Y)
	}

	return fmt.Sprintf("{\n%s\n}", strings.Join(s, ",\n"))
}

func RectCenterStr(body *resolv.Object, halfBoundingW, halfBoundingH, topPadding, bottomPadding, leftPadding, rightPadding, spaceOffsetX, spaceOffsetY float64) string {
	return fmt.Sprintf("{%.2f, %.2f}", body.X+leftPadding+halfBoundingW-spaceOffsetX, body.Y+bottomPadding+halfBoundingH-spaceOffsetY)
}
