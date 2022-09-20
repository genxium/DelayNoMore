package models

import (
	pb "server/pb_output"
)

func toPbVec2D(modelInstance *Vec2D) *pb.Vec2D {
	toRet := &pb.Vec2D{
		X: modelInstance.X,
		Y: modelInstance.Y,
	}
	return toRet
}

func toPbPolygon2D(modelInstance *Polygon2D) *pb.Polygon2D {
	toRet := &pb.Polygon2D{
		Anchor: toPbVec2D(modelInstance.Anchor),
		Points: make([]*pb.Vec2D, len(modelInstance.Points)),
	}
	for index, p := range modelInstance.Points {
		toRet.Points[index] = toPbVec2D(p)
	}
	return toRet
}

func toPbVec2DList(modelInstance *Vec2DList) *pb.Vec2DList {
	toRet := &pb.Vec2DList{
		Vec2DList: make([]*pb.Vec2D, len(*modelInstance)),
	}
	for k, v := range *modelInstance {
		toRet.Vec2DList[k] = toPbVec2D(v)
	}
	return toRet
}

func toPbPolygon2DList(modelInstance *Polygon2DList) *pb.Polygon2DList {
	toRet := &pb.Polygon2DList{
		Polygon2DList: make([]*pb.Polygon2D, len(*modelInstance)),
	}
	for k, v := range *modelInstance {
		toRet.Polygon2DList[k] = toPbPolygon2D(v)
	}
	return toRet
}

func ToPbStrToBattleColliderInfo(intervalToPing int32, willKickIfInactiveFor int32, boundRoomId int32, stageName string, modelInstance1 StrToVec2DListMap, modelInstance2 StrToPolygon2DListMap, stageDiscreteW int32, stageDiscreteH int32, stageTileW int32, stageTileH int32) *pb.BattleColliderInfo {
	toRet := &pb.BattleColliderInfo{
		IntervalToPing:        intervalToPing,
		WillKickIfInactiveFor: willKickIfInactiveFor,
		BoundRoomId:           boundRoomId,
		StageName:             stageName,
		StrToVec2DListMap:     make(map[string]*pb.Vec2DList, 0),
		StrToPolygon2DListMap: make(map[string]*pb.Polygon2DList, 0),
		StageDiscreteW:        stageDiscreteW,
		StageDiscreteH:        stageDiscreteH,
		StageTileW:            stageTileW,
		StageTileH:            stageTileH,
	}
	for k, v := range modelInstance1 {
		toRet.StrToVec2DListMap[k] = toPbVec2DList(v)
	}
	for k, v := range modelInstance2 {
		toRet.StrToPolygon2DListMap[k] = toPbPolygon2DList(v)
	}
	return toRet
}

func toPbPlayers(modelInstances map[int32]*Player) map[int32]*pb.Player {
	toRet := make(map[int32]*pb.Player, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.Player{
			Id: last.Id,
			X:  last.X,
			Y:  last.Y,
			Dir: &pb.Direction{
				Dx: last.Dir.Dx,
				Dy: last.Dir.Dy,
			},
			Speed:       last.Speed,
			BattleState: last.BattleState,
			Score:       last.Score,
			Removed:     last.Removed,
			JoinIndex:   last.JoinIndex,
		}
	}

	return toRet
}

func toPbTreasures(modelInstances map[int32]*Treasure) map[int32]*pb.Treasure {
	toRet := make(map[int32]*pb.Treasure, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.Treasure{
			Id:              last.Id,
			LocalIdInBattle: last.LocalIdInBattle,
			Score:           last.Score,
			X:               last.X,
			Y:               last.Y,
			Removed:         last.Removed,
			Type:            last.Type,
		}
	}

	return toRet
}

func toPbTraps(modelInstances map[int32]*Trap) map[int32]*pb.Trap {
	toRet := make(map[int32]*pb.Trap, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.Trap{
			Id:              last.Id,
			LocalIdInBattle: last.LocalIdInBattle,
			X:               last.X,
			Y:               last.Y,
			Removed:         last.Removed,
			Type:            last.Type,
		}
	}

	return toRet
}

func toPbBullets(modelInstances map[int32]*Bullet) map[int32]*pb.Bullet {
	toRet := make(map[int32]*pb.Bullet, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		if nil == last.StartAtPoint || nil == last.EndAtPoint {
			continue
		}
		toRet[k] = &pb.Bullet{
			LocalIdInBattle: last.LocalIdInBattle,
			LinearSpeed:     last.LinearSpeed,
			X:               last.X,
			Y:               last.Y,
			Removed:         last.Removed,
			StartAtPoint: &pb.Vec2D{
				X: last.StartAtPoint.X,
				Y: last.StartAtPoint.Y,
			},
			EndAtPoint: &pb.Vec2D{
				X: last.EndAtPoint.X,
				Y: last.EndAtPoint.Y,
			},
		}
	}

	return toRet
}

func toPbSpeedShoes(modelInstances map[int32]*SpeedShoe) map[int32]*pb.SpeedShoe {
	toRet := make(map[int32]*pb.SpeedShoe, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.SpeedShoe{
			Id:              last.Id,
			LocalIdInBattle: last.LocalIdInBattle,
			X:               last.X,
			Y:               last.Y,
			Removed:         last.Removed,
			Type:            last.Type,
		}
	}

	return toRet
}

func toPbGuardTowers(modelInstances map[int32]*GuardTower) map[int32]*pb.GuardTower {
	toRet := make(map[int32]*pb.GuardTower, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.GuardTower{
			Id:              last.Id,
			LocalIdInBattle: last.LocalIdInBattle,
			X:               last.X,
			Y:               last.Y,
			Removed:         last.Removed,
			Type:            last.Type,
		}
	}

	return toRet
}
