package models

import (
	pb "battle_srv/protos"
	"jsexport/battle"
)

func toPbRoomDownsyncFrame(rdf *battle.RoomDownsyncFrame) *pb.RoomDownsyncFrame {
	if nil == rdf {
		return nil
	}
	ret := &pb.RoomDownsyncFrame{
		Id:                       rdf.Id,
		PlayersArr:               make([]*pb.PlayerDownsync, len(rdf.PlayersArr), len(rdf.PlayersArr)),
		MeleeBullets:             make([]*pb.MeleeBullet, len(rdf.MeleeBullets), len(rdf.MeleeBullets)),
		CountdownNanos:           rdf.CountdownNanos,
		BackendUnconfirmedMask:   rdf.BackendUnconfirmedMask,
		ShouldForceResync:        rdf.ShouldForceResync,
		PlayerOpPatternToSkillId: make(map[int32]int32),
	}

	for i, last := range rdf.PlayersArr {
		pbPlayer := &pb.PlayerDownsync{
			Id:              last.Id,
			VirtualGridX:    last.VirtualGridX,
			VirtualGridY:    last.VirtualGridY,
			DirX:            last.DirX,
			DirY:            last.DirY,
			VelX:            last.VelX,
			VelY:            last.VelY,
			Speed:           last.Speed,
			BattleState:     last.BattleState,
			CharacterState:  last.CharacterState,
			InAir:           last.InAir,
			JoinIndex:       last.JoinIndex,
			ColliderRadius:  last.ColliderRadius,
			Score:           last.Score,
			Hp:              last.Hp,
			MaxHp:           last.MaxHp,
			Removed:         last.Removed,
			FramesToRecover: last.FramesToRecover,
			FramesInChState: last.FramesInChState,
		}
		ret.PlayersArr[i] = pbPlayer
	}

	for i, last := range rdf.MeleeBullets {
		pbBullet := &pb.MeleeBullet{
			BattleLocalId:         last.BattleLocalId,
			StartupFrames:         last.StartupFrames,
			ActiveFrames:          last.ActiveFrames,
			RecoveryFrames:        last.RecoveryFrames,
			RecoveryFramesOnBlock: last.RecoveryFramesOnBlock,
			RecoveryFramesOnHit:   last.RecoveryFramesOnHit,
			HitboxOffset:          last.HitboxOffset,
			HitStunFrames:         last.HitStunFrames,
			BlockStunFrames:       last.BlockStunFrames,
			Pushback:              last.Pushback,
			ReleaseTriggerType:    last.ReleaseTriggerType,
			Damage:                last.Damage,

			SelfMoveforwardX: last.SelfMoveforwardX,
			SelfMoveforwardY: last.SelfMoveforwardY,
			HitboxSizeX:      last.HitboxSizeX,
			HitboxSizeY:      last.HitboxSizeY,

			OffenderJoinIndex: last.OffenderJoinIndex,
			OffenderPlayerId:  last.OffenderPlayerId,
		}
		ret.MeleeBullets[i] = pbBullet
	}

	for i, last := range rdf.PlayerOpPatternToSkillId {
		ret.PlayerOpPatternToSkillId[int32(i)] = int32(last)
	}

	return ret
}

func toPbPlayers(modelInstances map[int32]*Player, withMetaInfo bool) []*pb.PlayerDownsync {
	toRet := make([]*pb.PlayerDownsync, len(modelInstances), len(modelInstances))
	if nil == modelInstances {
		return toRet
	}

	for _, last := range modelInstances {
		pbPlayer := &pb.PlayerDownsync{
			Id:              last.Id,
			VirtualGridX:    last.VirtualGridX,
			VirtualGridY:    last.VirtualGridY,
			DirX:            last.DirX,
			DirY:            last.DirY,
			VelX:            last.VelX,
			VelY:            last.VelY,
			Speed:           last.Speed,
			BattleState:     last.BattleState,
			CharacterState:  last.CharacterState,
			InAir:           last.InAir,
			JoinIndex:       last.JoinIndex,
			ColliderRadius:  last.ColliderRadius,
			Score:           last.Score,
			Removed:         last.Removed,
			FramesToRecover: last.FramesToRecover,
			FramesInChState: last.FramesInChState,
		}
		if withMetaInfo {
			pbPlayer.Name = last.Name
			pbPlayer.DisplayName = last.DisplayName
			pbPlayer.Avatar = last.Avatar
		}
		toRet[last.JoinIndex-1] = pbPlayer
	}

	return toRet
}

func toJsPlayers(modelInstances map[int32]*Player) []*battle.PlayerDownsync {
	toRet := make([]*battle.PlayerDownsync, len(modelInstances), len(modelInstances))
	if nil == modelInstances {
		return toRet
	}

	for _, last := range modelInstances {
		toRet[last.JoinIndex-1] = &battle.PlayerDownsync{
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
	}

	return toRet
}
