package battle

var Characters = map[int]*CharacterConfig{
	0: &CharacterConfig{
		SpeciesId:   0,
		SpeciesName: "MonkGirl",

		InAirIdleFrameIdxTurningPoint: 11,
		InAirIdleFrameIdxTurnedCycle:  1,

		LayDownFrames:          16,
		LayDownFramesToRecover: 16,

		GetUpFrames:          33,
		GetUpFramesToRecover: 30, // 3 invinsible frames for just-blown-up character to make a comeback

		JumpingInitVelY: int(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),

		PatternIdToSkillId: map[int]int{
			0: 1, // Atk1
			1: 2, // InAirAtk1
		},
	},
}

var skillIdToBullet = map[int]interface{}{
	1: &MeleeBullet{
		Bullet: Bullet{
			// for offender
			StartupFrames:         int32(5),
			ActiveFrames:          int32(10),
			RecoveryFrames:        int32(34),
			RecoveryFramesOnBlock: int32(34),
			RecoveryFramesOnHit:   int32(34),
			HitboxOffset:          float64(12.0), // should be about the radius of the PlayerCollider

			// for defender
			HitStunFrames:      int32(18),
			BlockStunFrames:    int32(9),
			Pushback:           float64(8.0),
			ReleaseTriggerType: int32(1), // 1: rising-edge, 2: falling-edge
			Damage:             int32(5),

			SelfMoveforwardX: 0,
			SelfMoveforwardY: 0,
			HitboxSizeX:      24.0,
			HitboxSizeY:      32.0,
		},
	},
	2: &MeleeBullet{
		Bullet: Bullet{
			// for offender
			StartupFrames:         int32(3),
			ActiveFrames:          int32(20),
			RecoveryFrames:        int32(34),
			RecoveryFramesOnBlock: int32(34),
			RecoveryFramesOnHit:   int32(34),
			HitboxOffset:          float64(16.0), // should be about the radius of the PlayerCollider

			// for defender
			HitStunFrames:      int32(18),
			BlockStunFrames:    int32(9),
			Pushback:           float64(6.0),
	        BlowUpVelY:         int32(float64(3) * WORLD_TO_VIRTUAL_GRID_RATIO), 
			ReleaseTriggerType: int32(1), // 1: rising-edge, 2: falling-edge
			Damage:             int32(5),

			SelfMoveforwardX: 0,
			SelfMoveforwardY: 0,
			HitboxSizeX:      32.0,
			HitboxSizeY:      24.0,
		},
	},
}
