package battle

type CharacterConfig struct {
	SpeciesId   int
	SpeciesName string

	InAirIdleFrameIdxTurningPoint int
	InAirIdleFrameIdxTurnedCycle  int

	LayDownFrames          int32
	LayDownFramesToRecover int32

	GetUpFrames          int32
	GetUpFramesToRecover int32

	JumpingInitVelY int32

	PatternIdToSkillId map[int]int
}

var Characters = map[int]*CharacterConfig{
	0: &CharacterConfig{
		SpeciesId:   0,
		SpeciesName: "MonkGirl",

		InAirIdleFrameIdxTurningPoint: 11,
		InAirIdleFrameIdxTurnedCycle:  1,

		LayDownFrames:          int32(16),
		LayDownFramesToRecover: int32(16),

		GetUpFrames:          int32(33),
		GetUpFramesToRecover: int32(30), // 3 invinsible frames for just-blown-up character to make a comeback

		JumpingInitVelY: int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),

		PatternIdToSkillId: map[int]int{
			0: 1, // Atk1
			1: 2, // InAirAtk1
		},
	},
}

var skills = map[int]*Skill{
	1: &Skill{
		RecoveryFrames:        int32(34),
		RecoveryFramesOnBlock: int32(34),
		RecoveryFramesOnHit:   int32(34),
		ReleaseTriggerType:    int32(1),
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(5),
					ActiveFrames:    int32(10),
					HitStunFrames:   int32(18),
					BlockStunFrames: int32(9),
					Damage:          int32(5),
					PushbackX:       int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackY:       int32(0),
					HitboxOffsetX:   int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
				},
			},
		},
	},
	2: &Skill{
		RecoveryFrames:        int32(34),
		RecoveryFramesOnBlock: int32(34),
		RecoveryFramesOnHit:   int32(34),
		ReleaseTriggerType:    int32(1),
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(3),
					ActiveFrames:    int32(20),
					HitStunFrames:   int32(18),
					BlockStunFrames: int32(9),
					Damage:          int32(5),
					PushbackX:       int32(float64(6) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackY:       int32(0),
					HitboxOffsetX:   int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
				},
			},
		},
	},
}
