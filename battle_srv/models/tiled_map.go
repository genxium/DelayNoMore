package models

import (
	"bytes"
	"compress/zlib"
	"encoding/base64"
	"encoding/xml"
	"errors"
	"fmt"
	"github.com/ByteArena/box2d"
	"go.uber.org/zap"
	"io/ioutil"
	"math"
	. "server/common"
	"strconv"
	"strings"
)

const (
	LOW_SCORE_TREASURE_TYPE  = 1
	HIGH_SCORE_TREASURE_TYPE = 2

	SPEED_SHOES_TYPE = 3

	LOW_SCORE_TREASURE_SCORE  = 100
	HIGH_SCORE_TREASURE_SCORE = 200

	FLIPPED_HORIZONTALLY_FLAG uint32 = 0x80000000
	FLIPPED_VERTICALLY_FLAG   uint32 = 0x40000000
	FLIPPED_DIAGONALLY_FLAG   uint32 = 0x20000000
)

// For either a "*.tmx" or "*.tsx" file. [begins]
type TmxOrTsxProperty struct {
	Name  string `xml:"name,attr"`
	Value string `xml:"value,attr"`
}

type TmxOrTsxProperties struct {
	Property []*TmxOrTsxProperty `xml:"property"`
}

type TmxOrTsxPolyline struct {
	Points string `xml:"points,attr"`
}

type TmxOrTsxObject struct {
	Id         int                 `xml:"id,attr"`
	Gid        *int                `xml:"gid,attr"`
	X          float64             `xml:"x,attr"`
	Y          float64             `xml:"y,attr"`
	Properties *TmxOrTsxProperties `xml:"properties"`
	Polyline   *TmxOrTsxPolyline   `xml:"polyline"`
	Width      *float64            `xml:"width,attr"`
	Height     *float64            `xml:"height,attr"`
}

type TmxOrTsxObjectGroup struct {
	Draworder string            `xml:"draworder,attr"`
	Name      string            `xml:"name,attr"`
	Objects   []*TmxOrTsxObject `xml:"object"`
}

type TmxOrTsxImage struct {
	Source string `xml:"source,attr"`
	Width  int    `xml:"width,attr"`
	Height int    `xml:"height,attr"`
}

// For either a "*.tmx" or "*.tsx" file. [ends]

// Within a "*.tsx" file. [begins]
type Tsx struct {
	Name       string           `xml:"name,attr"`
	TileWidth  int              `xml:"tilewidth,attr"`
	TileHeight int              `xml:"tileheight,attr"`
	TileCount  int              `xml:"tilecount,attr"`
	Columns    int              `xml:"columns,attr"`
	Image      []*TmxOrTsxImage `xml:"image"`
	Tiles      []*TsxTile       `xml:"tile"`
}

type TsxTile struct {
	Id          int                  `xml:"id,attr"`
	ObjectGroup *TmxOrTsxObjectGroup `xml:"objectgroup"`
	Properties  *TmxOrTsxProperties  `xml:"properties"`
}

// Within a "*.tsx" file. [ends]

// Within a "*.tmx" file. [begins]
type TmxLayerDecodedTileData struct {
	Id             uint32
	Tileset        *TmxTileset
	FlipHorizontal bool
	FlipVertical   bool
	FlipDiagonal   bool
}

type TmxLayerEncodedData struct {
	Encoding    string `xml:"encoding,attr"`
	Compression string `xml:"compression,attr"`
	Value       string `xml:",chardata"`
}

type TmxLayer struct {
	Name   string               `xml:"name,attr"`
	Width  int                  `xml:"width,attr"`
	Height int                  `xml:"height,attr"`
	Data   *TmxLayerEncodedData `xml:"data"`
	Tile   []*TmxLayerDecodedTileData
}

type TmxTileset struct {
	FirstGid   uint32           `xml:"firstgid,attr"`
	Name       string           `xml:"name,attr"`
	TileWidth  int              `xml:"tilewidth,attr"`
	TileHeight int              `xml:"tileheight,attr"`
	Images     []*TmxOrTsxImage `xml:"image"`
	Source     string           `xml:"source,attr"`
}

type TmxMap struct {
	Version      string                 `xml:"version,attr"`
	Orientation  string                 `xml:"orientation,attr"`
	Width        int                    `xml:"width,attr"`
	Height       int                    `xml:"height,attr"`
	TileWidth    int                    `xml:"tilewidth,attr"`
	TileHeight   int                    `xml:"tileheight,attr"`
	Properties   []*TmxOrTsxProperties  `xml:"properties"`
	Tilesets     []*TmxTileset          `xml:"tileset"`
	Layers       []*TmxLayer            `xml:"layer"`
	ObjectGroups []*TmxOrTsxObjectGroup `xml:"objectgroup"`
}

// Within a "*.tmx" file. [ends]

func (d *TmxLayerEncodedData) decodeBase64() ([]byte, error) {
	r := bytes.NewReader([]byte(strings.TrimSpace(d.Value)))
	decr := base64.NewDecoder(base64.StdEncoding, r)
	if d.Compression == "zlib" {
		rclose, err := zlib.NewReader(decr)
		if err != nil {
			Logger.Error("tmx data decode zlib error: ", zap.Any("encoding", d.Encoding), zap.Any("compression", d.Compression), zap.Any("value", d.Value))
			return nil, err
		}
		return ioutil.ReadAll(rclose)
	}
	Logger.Error("tmx data decode invalid compression: ", zap.Any("encoding", d.Encoding), zap.Any("compression", d.Compression), zap.Any("value", d.Value))
	return nil, errors.New("Invalid compression.")
}

func (l *TmxLayer) decodeBase64() ([]uint32, error) {
	databytes, err := l.Data.decodeBase64()
	if err != nil {
		return nil, err
	}
	if l.Width == 0 || l.Height == 0 {
		return nil, errors.New("Zero width or height.")
	}
	if len(databytes) != l.Height*l.Width*4 {
		Logger.Error("TmxLayer decodeBase64 invalid data bytes:", zap.Any("width", l.Width), zap.Any("height", l.Height), zap.Any("data lenght", len(databytes)))
		return nil, errors.New("Data length error.")
	}
	dindex := 0
	gids := make([]uint32, l.Height*l.Width)
	for h := 0; h < l.Height; h++ {
		for w := 0; w < l.Width; w++ {
			gid := uint32(databytes[dindex]) |
				uint32(databytes[dindex+1])<<8 |
				uint32(databytes[dindex+2])<<16 |
				uint32(databytes[dindex+3])<<24
			dindex += 4
			gids[h*l.Width+w] = gid
		}
	}
	return gids, nil
}

type Vec2DList []*Vec2D
type Polygon2DList []*Polygon2D
type StrToVec2DListMap map[string]*Vec2DList         // Note that it's deliberately NOT using "map[string]Vec2DList", for the easy of passing return value to "models/room.go".
type StrToPolygon2DListMap map[string]*Polygon2DList // Note that it's deliberately NOT using "map[string]Polygon2DList", for the easy of passing return value to "models/room.go".

func TmxPolylineToPolygon2DInB2World(pTmxMapIns *TmxMap, singleObjInTmxFile *TmxOrTsxObject, targetPolyline *TmxOrTsxPolyline) (*Polygon2D, error) {
	if nil == targetPolyline {
		return nil, nil
	}

	singleValueArray := strings.Split(targetPolyline.Points, " ")
	pointsCount := len(singleValueArray)

	if pointsCount >= box2d.B2_maxPolygonVertices {
		return nil, errors.New(fmt.Sprintf("During `TmxPolylineToPolygon2DInB2World`, you have a polygon with pointsCount == %v, exceeding or equal to box2d.B2_maxPolygonVertices == %v, of polyines [%v]", pointsCount, box2d.B2_maxPolygonVertices, singleValueArray))
	}

	theUntransformedAnchor := &Vec2D{
		X: singleObjInTmxFile.X,
		Y: singleObjInTmxFile.Y,
	}
	theTransformedAnchor := pTmxMapIns.continuousObjLayerOffsetToContinuousMapNodePos(theUntransformedAnchor)
	thePolygon2DFromPolyline := &Polygon2D{
		Anchor: &theTransformedAnchor,
		Points: make([]*Vec2D, len(singleValueArray)),
	}

	for k, value := range singleValueArray {
		thePolygon2DFromPolyline.Points[k] = &Vec2D{}
		for kk, v := range strings.Split(value, ",") {
			coordinateValue, err := strconv.ParseFloat(v, 64)
			if nil != err {
				panic(err)
			}
			if 0 == (kk % 2) {
				thePolygon2DFromPolyline.Points[k].X = (coordinateValue)
			} else {
				thePolygon2DFromPolyline.Points[k].Y = (coordinateValue)
			}
		}

		// Transform to B2World space coordinate.
		tmp := &Vec2D{
			X: thePolygon2DFromPolyline.Points[k].X,
			Y: thePolygon2DFromPolyline.Points[k].Y,
		}
		transformedTmp := pTmxMapIns.continuousObjLayerVecToContinuousMapNodeVec(tmp)
		thePolygon2DFromPolyline.Points[k].X = transformedTmp.X
		thePolygon2DFromPolyline.Points[k].Y = transformedTmp.Y
	}

	return thePolygon2DFromPolyline, nil
}

func TsxPolylineToOffsetsWrtTileCenterInB2World(pTmxMapIns *TmxMap, singleObjInTsxFile *TmxOrTsxObject, targetPolyline *TmxOrTsxPolyline, pTsxIns *Tsx) (*Polygon2D, error) {
	if nil == targetPolyline {
		return nil, nil
	}
	var factorHalf float64 = 0.5
	offsetFromTopLeftInTileLocalCoordX := singleObjInTsxFile.X
	offsetFromTopLeftInTileLocalCoordY := singleObjInTsxFile.Y

	singleValueArray := strings.Split(targetPolyline.Points, " ")
	pointsCount := len(singleValueArray)

	if pointsCount >= box2d.B2_maxPolygonVertices {
		return nil, errors.New(fmt.Sprintf("During `TsxPolylineToOffsetsWrtTileCenterInB2World`, you have a polygon with pointsCount == %v, exceeding or equal to box2d.B2_maxPolygonVertices == %v", pointsCount, box2d.B2_maxPolygonVertices))
	}

	thePolygon2DFromPolyline := &Polygon2D{
		Anchor:     nil,
		Points:     make([]*Vec2D, pointsCount),
		TileWidth:  pTsxIns.TileWidth,
		TileHeight: pTsxIns.TileHeight,
	}

	/*
	  [WARNING] In this case, the "Treasure"s and "GuardTower"s are put into Tmx file as "ImageObject"s, of each the "ProportionalAnchor" is (0.5, 0). Therefore we calculate that "thePolygon2DFromPolyline.Points" are "offsets(in B2World) w.r.t. the BottomCenter". See https://shimo.im/docs/SmLJJhXm2C8XMzZT for details.
	*/

	for k, value := range singleValueArray {
		thePolygon2DFromPolyline.Points[k] = &Vec2D{}
		for kk, v := range strings.Split(value, ",") {
			coordinateValue, err := strconv.ParseFloat(v, 64)
			if nil != err {
				panic(err)
			}
			if 0 == (kk % 2) {
				// W.r.t. center.
				thePolygon2DFromPolyline.Points[k].X = (coordinateValue + offsetFromTopLeftInTileLocalCoordX) - factorHalf*float64(pTsxIns.TileWidth)
			} else {
				// W.r.t. bottom.
				thePolygon2DFromPolyline.Points[k].Y = float64(pTsxIns.TileHeight) - (coordinateValue + offsetFromTopLeftInTileLocalCoordY)
			}
		}

		// No need to transform for B2World space coordinate because the marks in a Tsx file is already rectilinear.
	}

	return thePolygon2DFromPolyline, nil
}

func DeserializeTsxToColliderDict(pTmxMapIns *TmxMap, byteArrOfTsxFile []byte, firstGid int, gidBoundariesMapInB2World map[int]StrToPolygon2DListMap) error {
	pTsxIns := &Tsx{}
	err := xml.Unmarshal(byteArrOfTsxFile, pTsxIns)
	if nil != err {
		panic(err)
	}
	/*
		  // For debug-printing only. -- YFLu, 2019-09-04.

		  reserializedTmxMap, err := pTmxMapIns.ToXML()
			if nil != err {
				panic(err)
			}
	*/

	for _, tile := range pTsxIns.Tiles {
		globalGid := (firstGid + int(tile.Id))
		/**
				   Per tile xml str could be

				   ```
				   <tile id="13">
				    <objectgroup draworder="index">
				     <object id="1" x="-154" y="-159">
		          <properties>
		           <property name="boundary_type" value="guardTower"/>
		          </properties>
				      <polyline points="0,0 -95,179 18,407 361,434 458,168 333,-7"/>
				     </object>
				    </objectgroup>
				   </tile>
				   ```
				   , we currently REQUIRE that "`an object of a tile` with ONE OR MORE polylines must come with a single corresponding '<property name=`type` value=`...` />', and viceversa".

				  Refer to https://shimo.im/docs/SmLJJhXm2C8XMzZT for how we theoretically fit a "Polyline in Tsx" into a "Polygon2D" and then into the corresponding "B2BodyDef & B2Body in the `world of colliding bodies`".
		*/

		theObjGroup := tile.ObjectGroup
		if nil == theObjGroup {
			continue
		}
		for _, singleObj := range theObjGroup.Objects {
			if nil == singleObj.Polyline {
				// Temporarily omit those non-polyline-containing objects.
				continue
			}
			if nil == singleObj.Properties.Property || "boundary_type" != singleObj.Properties.Property[0].Name {
				continue
			}

			key := singleObj.Properties.Property[0].Value

			var theStrToPolygon2DListMap StrToPolygon2DListMap
			if existingStrToPolygon2DListMap, ok := gidBoundariesMapInB2World[globalGid]; ok {
				theStrToPolygon2DListMap = existingStrToPolygon2DListMap
			} else {
				gidBoundariesMapInB2World[globalGid] = make(StrToPolygon2DListMap, 0)
				theStrToPolygon2DListMap = gidBoundariesMapInB2World[globalGid]
			}

			var pThePolygon2DList *Polygon2DList
			if _, ok := theStrToPolygon2DListMap[key]; ok {
				pThePolygon2DList = theStrToPolygon2DListMap[key]
			} else {
				thePolygon2DList := make(Polygon2DList, 0)
				theStrToPolygon2DListMap[key] = &thePolygon2DList
				pThePolygon2DList = theStrToPolygon2DListMap[key]
			}

			thePolygon2DFromPolyline, err := TsxPolylineToOffsetsWrtTileCenterInB2World(pTmxMapIns, singleObj, singleObj.Polyline, pTsxIns)
			if nil != err {
				panic(err)
			}
			*pThePolygon2DList = append(*pThePolygon2DList, thePolygon2DFromPolyline)
		}
	}
	return nil
}

func ParseTmxLayersAndGroups(pTmxMapIns *TmxMap, gidBoundariesMapInB2World map[int]StrToPolygon2DListMap) (int32, int32, int32, int32, StrToVec2DListMap, StrToPolygon2DListMap, error) {
	toRetStrToVec2DListMap := make(StrToVec2DListMap, 0)
	toRetStrToPolygon2DListMap := make(StrToPolygon2DListMap, 0)
	/*
	   Note that both
	   - "Vec2D"s of "toRetStrToVec2DListMap", and
	   - "Polygon2D"s of "toRetStrToPolygon2DListMap"

	   are already transformed into the "coordinate of B2World".

	   -- YFLu
	*/

	for _, objGroup := range pTmxMapIns.ObjectGroups {
		switch objGroup.Name {
		case "PlayerStartingPos":
			var pTheVec2DListToCache *Vec2DList
			_, ok := toRetStrToVec2DListMap[objGroup.Name]
			if false == ok {
				theVec2DListToCache := make(Vec2DList, 0)
				toRetStrToVec2DListMap[objGroup.Name] = &theVec2DListToCache
				pTheVec2DListToCache = toRetStrToVec2DListMap[objGroup.Name]
			} else {
				pTheVec2DListToCache = toRetStrToVec2DListMap[objGroup.Name]
			}
			for _, singleObjInTmxFile := range objGroup.Objects {
				theUntransformedPos := &Vec2D{
					X: singleObjInTmxFile.X,
					Y: singleObjInTmxFile.Y,
				}
				thePosInWorld := pTmxMapIns.continuousObjLayerOffsetToContinuousMapNodePos(theUntransformedPos)
				*pTheVec2DListToCache = append(*pTheVec2DListToCache, &thePosInWorld)
			}
		case "Pumpkin", "SpeedShoe":
		case "Barrier":
			/*
							   Note that in this case, the "Polygon2D.Anchor" of each "TmxOrTsxObject" is located exactly in an overlapping with "Polygon2D.Points[0]" w.r.t. B2World.

				         -- YFLu
			*/
			var pThePolygon2DListToCache *Polygon2DList
			_, ok := toRetStrToPolygon2DListMap[objGroup.Name]
			if false == ok {
				thePolygon2DListToCache := make(Polygon2DList, 0)
				toRetStrToPolygon2DListMap[objGroup.Name] = &thePolygon2DListToCache
				pThePolygon2DListToCache = toRetStrToPolygon2DListMap[objGroup.Name]
			} else {
				pThePolygon2DListToCache = toRetStrToPolygon2DListMap[objGroup.Name]
			}

			for _, singleObjInTmxFile := range objGroup.Objects {
				if nil == singleObjInTmxFile.Polyline {
					continue
				}
				if nil == singleObjInTmxFile.Properties.Property || "boundary_type" != singleObjInTmxFile.Properties.Property[0].Name || "barrier" != singleObjInTmxFile.Properties.Property[0].Value {
					continue
				}

				thePolygon2DInWorld, err := TmxPolylineToPolygon2DInB2World(pTmxMapIns, singleObjInTmxFile, singleObjInTmxFile.Polyline)
				if nil != err {
					panic(err)
				}
				*pThePolygon2DListToCache = append(*pThePolygon2DListToCache, thePolygon2DInWorld)
			}
		case "LowScoreTreasure", "GuardTower", "HighScoreTreasure":
			/*
							   Note that in this case, the "Polygon2D.Anchor" of each "TmxOrTsxObject" ISN'T located exactly in an overlapping with "Polygon2D.Points[0]" w.r.t. B2World, refer to "https://shimo.im/docs/SmLJJhXm2C8XMzZT" for details.

				         -- YFLu
			*/
			for _, singleObjInTmxFile := range objGroup.Objects {
				if nil == singleObjInTmxFile.Gid {
					continue
				}
				theGlobalGid := singleObjInTmxFile.Gid
				theStrToPolygon2DListMap, ok := gidBoundariesMapInB2World[*theGlobalGid]
				if false == ok {
					continue
				}

				pThePolygon2DList, ok := theStrToPolygon2DListMap[objGroup.Name]
				if false == ok {
					continue
				}

				var pThePolygon2DListToCache *Polygon2DList
				_, ok = toRetStrToPolygon2DListMap[objGroup.Name]
				if false == ok {
					thePolygon2DListToCache := make(Polygon2DList, 0)
					toRetStrToPolygon2DListMap[objGroup.Name] = &thePolygon2DListToCache
					pThePolygon2DListToCache = toRetStrToPolygon2DListMap[objGroup.Name]
				} else {
					pThePolygon2DListToCache = toRetStrToPolygon2DListMap[objGroup.Name]
				}

				for _, thePolygon2D := range *pThePolygon2DList {
					theUntransformedBottomCenterAsAnchor := &Vec2D{
						X: singleObjInTmxFile.X,
						Y: singleObjInTmxFile.Y,
					}

					theTransformedBottomCenterAsAnchor := pTmxMapIns.continuousObjLayerOffsetToContinuousMapNodePos(theUntransformedBottomCenterAsAnchor)

					thePolygon2DInWorld := &Polygon2D{
						Anchor:     &theTransformedBottomCenterAsAnchor,
						Points:     make([]*Vec2D, len(thePolygon2D.Points)),
						TileWidth:  thePolygon2D.TileWidth,
						TileHeight: thePolygon2D.TileHeight,
					}
					if nil != singleObjInTmxFile.Width && nil != singleObjInTmxFile.Height {
						thePolygon2DInWorld.TmxObjectWidth = *singleObjInTmxFile.Width
						thePolygon2DInWorld.TmxObjectHeight = *singleObjInTmxFile.Height
					}
					for kk, p := range thePolygon2D.Points {
						// [WARNING] It's intentionally recreating a copy of "Vec2D" here.
						thePolygon2DInWorld.Points[kk] = &Vec2D{
							X: p.X,
							Y: p.Y,
						}
					}
					*pThePolygon2DListToCache = append(*pThePolygon2DListToCache, thePolygon2DInWorld)
				}
			}
		default:
		}
	}
	return int32(pTmxMapIns.Width), int32(pTmxMapIns.Height), int32(pTmxMapIns.TileWidth), int32(pTmxMapIns.TileHeight), toRetStrToVec2DListMap, toRetStrToPolygon2DListMap, nil
}

func (pTmxMap *TmxMap) ToXML() (string, error) {
	ret, err := xml.Marshal(pTmxMap)
	return string(ret[:]), err
}

type TileRectilinearSize struct {
	Width  float64
	Height float64
}

func (pTmxMapIns *TmxMap) continuousObjLayerVecToContinuousMapNodeVec(continuousObjLayerVec *Vec2D) Vec2D {
	var tileRectilinearSize TileRectilinearSize
	tileRectilinearSize.Width = float64(pTmxMapIns.TileWidth)
	tileRectilinearSize.Height = float64(pTmxMapIns.TileHeight)
	tileSizeUnifiedLength := math.Sqrt(tileRectilinearSize.Width*tileRectilinearSize.Width*0.25 + tileRectilinearSize.Height*tileRectilinearSize.Height*0.25)
	isometricObjectLayerPointOffsetScaleFactor := (tileSizeUnifiedLength / tileRectilinearSize.Height)
	cosineThetaRadian := (tileRectilinearSize.Width * 0.5) / tileSizeUnifiedLength
	sineThetaRadian := (tileRectilinearSize.Height * 0.5) / tileSizeUnifiedLength

	transMat := [...][2]float64{
		{isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian, -isometricObjectLayerPointOffsetScaleFactor * cosineThetaRadian},
		{-isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian, -isometricObjectLayerPointOffsetScaleFactor * sineThetaRadian},
	}
	convertedVecX := transMat[0][0]*continuousObjLayerVec.X + transMat[0][1]*continuousObjLayerVec.Y
	convertedVecY := transMat[1][0]*continuousObjLayerVec.X + transMat[1][1]*continuousObjLayerVec.Y
	converted := Vec2D{
		X: convertedVecX,
		Y: convertedVecY,
	}
	return converted
}

func (pTmxMapIns *TmxMap) continuousObjLayerOffsetToContinuousMapNodePos(continuousObjLayerOffset *Vec2D) Vec2D {
	layerOffset := Vec2D{
		X: 0,
		Y: float64(pTmxMapIns.Height*pTmxMapIns.TileHeight) * 0.5,
	}

	calibratedVec := continuousObjLayerOffset
	convertedVec := pTmxMapIns.continuousObjLayerVecToContinuousMapNodeVec(calibratedVec)

	toRet := Vec2D{
		X: layerOffset.X + convertedVec.X,
		Y: layerOffset.Y + convertedVec.Y,
	}

	return toRet
}
