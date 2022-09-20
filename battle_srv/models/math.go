package models

import (
	"fmt"
	"github.com/ByteArena/box2d"
	"math"
)

// Use type `float64` for json unmarshalling of numbers.
type Direction struct {
	Dx int32 `json:"dx,omitempty"`
	Dy int32 `json:"dy,omitempty"`
}

type Vec2D struct {
	X float64 `json:"x,omitempty"`
	Y float64 `json:"y,omitempty"`
}

func CreateVec2DFromB2Vec2(b2V2 box2d.B2Vec2) *Vec2D {
	return &Vec2D{
		X: b2V2.X,
		Y: b2V2.Y,
	}
}

func (v2 *Vec2D) ToB2Vec2() box2d.B2Vec2 {
	return box2d.MakeB2Vec2(v2.X, v2.Y)
}

type Polygon2D struct {
	Anchor *Vec2D   `json:"-"` // This "Polygon2D.Anchor" is used to be assigned to "B2BodyDef.Position", which in turn is used as the position of the FIRST POINT of the polygon.
	Points []*Vec2D `json:"-"`

	/*
	   When used to represent a "polyline directly drawn in a `Tmx file`", we can initialize both "Anchor" and "Points" simultaneously.

	   Yet when used to represent a "polyline drawn in a `Tsx file`", we have to first initialize "Points w.r.t. center of the tile-rectangle", and then "Anchor(initially nil) of the tile positioned in the `Tmx file`".

	   Refer to https://shimo.im/docs/SmLJJhXm2C8XMzZT for more information.
	*/

	/*
	  [WARNING] Used to cache "`TileWidth & TileHeight` of a Tsx file" only.
	*/
	TileWidth  int
	TileHeight int

	/*
	  [WARNING] Used to cache "`Width & TileHeight` of an object in Tmx file" only.
	*/
	TmxObjectWidth  float64
	TmxObjectHeight float64
}

func MoveDynamicBody(body *box2d.B2Body, pToTargetPos *box2d.B2Vec2, inSeconds float64) {
	if body.GetType() != box2d.B2BodyType.B2_dynamicBody {
		return
	}
	body.SetTransform(*pToTargetPos, 0.0)
	body.SetLinearVelocity(box2d.MakeB2Vec2(0.0, 0.0))
	body.SetAngularVelocity(0.0)
}

func PrettyPrintFixture(fix *box2d.B2Fixture) {
	fmt.Printf("\t\tfriction:\t%v\n", fix.M_friction)
	fmt.Printf("\t\trestitution:\t%v\n", fix.M_restitution)
	fmt.Printf("\t\tdensity:\t%v\n", fix.M_density)
	fmt.Printf("\t\tisSensor:\t%v\n", fix.M_isSensor)
	fmt.Printf("\t\tfilter.categoryBits:\t%d\n", fix.M_filter.CategoryBits)
	fmt.Printf("\t\tfilter.maskBits:\t%d\n", fix.M_filter.MaskBits)
	fmt.Printf("\t\tfilter.groupIndex:\t%d\n", fix.M_filter.GroupIndex)

	switch fix.M_shape.GetType() {
	case box2d.B2Shape_Type.E_circle:
		{
			s := fix.M_shape.(*box2d.B2CircleShape)
			fmt.Printf("\t\tb2CircleShape shape: {\n")
			fmt.Printf("\t\t\tradius:\t%v\n", s.M_radius)
			fmt.Printf("\t\t\toffset:\t%v\n", s.M_p)
			fmt.Printf("\t\t}\n")
		}
		break

	case box2d.B2Shape_Type.E_polygon:
		{
			s := fix.M_shape.(*box2d.B2PolygonShape)
			fmt.Printf("\t\tb2PolygonShape shape: {\n")
			for i := 0; i < s.M_count; i++ {
				fmt.Printf("\t\t\t%v\n", s.M_vertices[i])
			}
			fmt.Printf("\t\t}\n")
		}
		break

	default:
		break
	}
}

func PrettyPrintBody(body *box2d.B2Body) {
	bodyIndex := body.M_islandIndex

	fmt.Printf("{\n")
	fmt.Printf("\tHeapRAM addr:\t%p\n", body)
	fmt.Printf("\ttype:\t%d\n", body.M_type)
	fmt.Printf("\tposition:\t%v\n", body.GetPosition())
	fmt.Printf("\tangle:\t%v\n", body.M_sweep.A)
	fmt.Printf("\tlinearVelocity:\t%v\n", body.GetLinearVelocity())
	fmt.Printf("\tangularVelocity:\t%v\n", body.GetAngularVelocity())
	fmt.Printf("\tlinearDamping:\t%v\n", body.M_linearDamping)
	fmt.Printf("\tangularDamping:\t%v\n", body.M_angularDamping)
	fmt.Printf("\tallowSleep:\t%d\n", body.M_flags&box2d.B2Body_Flags.E_autoSleepFlag)
	fmt.Printf("\tawake:\t%d\n", body.M_flags&box2d.B2Body_Flags.E_awakeFlag)
	fmt.Printf("\tfixedRotation:\t%d\n", body.M_flags&box2d.B2Body_Flags.E_fixedRotationFlag)
	fmt.Printf("\tbullet:\t%d\n", body.M_flags&box2d.B2Body_Flags.E_bulletFlag)
	fmt.Printf("\tactive:\t%d\n", body.M_flags&box2d.B2Body_Flags.E_activeFlag)
	fmt.Printf("\tgravityScale:\t%v\n", body.M_gravityScale)
	fmt.Printf("\tislandIndex:\t%v\n", bodyIndex)
	fmt.Printf("\tfixtures: {\n")
	for f := body.M_fixtureList; f != nil; f = f.M_next {
		PrettyPrintFixture(f)
	}
	fmt.Printf("\t}\n")
	fmt.Printf("}\n")
}

func Distance(pt1 *Vec2D, pt2 *Vec2D) float64 {
	dx := pt1.X - pt2.X
	dy := pt1.Y - pt2.Y
	return math.Sqrt(dx*dx + dy*dy)
}
