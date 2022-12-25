package models

import (
	pb "battle_srv/protos"
	"jsexport/battle"
)

func toPbPlayers(modelInstances map[int32]*Player, withMetaInfo bool) map[int32]*pb.PlayerDownsync {
	toRet := make(map[int32]*pb.PlayerDownsync, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &pb.PlayerDownsync{
			Id:             last.Id,
			VirtualGridX:   last.VirtualGridX,
			VirtualGridY:   last.VirtualGridY,
			DirX:           last.DirX,
			DirY:           last.DirY,
			VelX:           last.VelX,
			VelY:           last.VelY,
			Speed:          last.Speed,
			BattleState:    last.BattleState,
			CharacterState: last.CharacterState,
			InAir:          last.InAir,
			JoinIndex:      last.JoinIndex,
			ColliderRadius: last.ColliderRadius,
			Score:          last.Score,
			Removed:        last.Removed,
		}
		if withMetaInfo {
			toRet[k].Name = last.Name
			toRet[k].DisplayName = last.DisplayName
			toRet[k].Avatar = last.Avatar
		}
	}

	return toRet
}

func toJsPlayers(modelInstances map[int32]*Player, withMetaInfo bool) map[int32]*battle.PlayerDownsync {
	toRet := make(map[int32]*battle.PlayerDownsync, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &battle.PlayerDownsync{
			Id:             last.Id,
			VirtualGridX:   last.VirtualGridX,
			VirtualGridY:   last.VirtualGridY,
			DirX:           last.DirX,
			DirY:           last.DirY,
			VelX:           last.VelX,
			VelY:           last.VelY,
			Speed:          last.Speed,
			BattleState:    last.BattleState,
			CharacterState: last.CharacterState,
			InAir:          last.InAir,
			JoinIndex:      last.JoinIndex,
			ColliderRadius: last.ColliderRadius,
			Score:          last.Score,
			Removed:        last.Removed,
		}
		if withMetaInfo {
			toRet[k].Name = last.Name
			toRet[k].DisplayName = last.DisplayName
			toRet[k].Avatar = last.Avatar
		}
	}

	return toRet
}
