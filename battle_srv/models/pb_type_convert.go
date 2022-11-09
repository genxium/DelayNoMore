package models

import (
	. "battle_srv/protos"
	. "dnmshared/sharedprotos"
)

func toPbPlayers(modelInstances map[int32]*Player) map[int32]*PlayerDownsync {
	toRet := make(map[int32]*PlayerDownsync, 0)
	if nil == modelInstances {
		return toRet
	}

	for k, last := range modelInstances {
		toRet[k] = &PlayerDownsync{
			Id:           last.Id,
			VirtualGridX: last.VirtualGridX,
			VirtualGridY: last.VirtualGridY,
			Dir: &Direction{
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
