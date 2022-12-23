package models

import (
	. "jsexport/protos"
)

func toPbPlayers(modelInstances map[int32]*Player, withMetaInfo bool) map[int32]*PlayerDownsync {
	toRet := make(map[int32]*PlayerDownsync, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &PlayerDownsync{
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
