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
			1:   1,   // Atk1
			2:   2,   // Atk2
			3:   3,   // Atk3
			255: 255, // InAirAtk1
		},
	},
}

var skills = map[int]*Skill{
	1: &Skill{
		RecoveryFrames:        int32(20),
		RecoveryFramesOnBlock: int32(20),
		RecoveryFramesOnHit:   int32(20),
		ReleaseTriggerType:    int32(1),
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(5),
					ActiveFrames:       int32(10),
					HitStunFrames:      int32(13),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(8),
					CancellableEdFrame: int32(20),
					// TODO: Use non-zero "selfLockVel"
				},
			},
		},
	},
	2: &Skill{
		RecoveryFrames:        int32(36),
		RecoveryFramesOnBlock: int32(36),
		RecoveryFramesOnHit:   int32(36),
		ReleaseTriggerType:    int32(1),
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(3),
					ActiveFrames:       int32(20),
					HitStunFrames:      int32(18),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(18) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(18),
					CancellableEdFrame: int32(36),
				},
			},
		},
	},
	3: &Skill{
		RecoveryFrames:        int32(60),
		RecoveryFramesOnBlock: int32(60),
		RecoveryFramesOnHit:   int32(60),
		ReleaseTriggerType:    int32(1),
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(1),
					ActiveFrames:    int32(30),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					PushbackVelX:    int32(float64(1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(4) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
				},
			},
		},
	},
	255: &Skill{
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
					PushbackVelX:    int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(0),
					HitboxOffsetX:   int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
				},
			},
		},
	},
}
