package battle

type SkillMapperType func(patternId int, currPlayerDownsync *PlayerDownsync) int

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

	SkillMapper SkillMapperType
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

		SkillMapper: func(patternId int, currPlayerDownsync *PlayerDownsync) int {
			if 1 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover {
					if currPlayerDownsync.InAir {
						return 255
					} else {
						return 1
					}
				} else {
					// Now that "0 < FramesToRecover", we're only able to fire any skill if it's a cancellation
					if skillConfig, existent1 := skills[int(currPlayerDownsync.ActiveSkillId)]; existent1 {
						switch v := skillConfig.Hits[currPlayerDownsync.ActiveSkillHit].(type) {
						case *MeleeBullet:
							if v.CancellableStFrame <= currPlayerDownsync.FramesInChState && currPlayerDownsync.FramesInChState < v.CancellableEdFrame {
								if nextSkillId, existent2 := v.CancelTransit[patternId]; existent2 {
									return nextSkillId
								}
							}
						}
					}
				}
			}

			// By default no skill can be fired
			return NO_SKILL
		},
	},
	1: &CharacterConfig{
		SpeciesId:   1,
		SpeciesName: "KnifeGirl",

		InAirIdleFrameIdxTurningPoint: 9,
		InAirIdleFrameIdxTurnedCycle:  1,

		LayDownFrames:          int32(16),
		LayDownFramesToRecover: int32(16),

		GetUpFrames:          int32(30),
		GetUpFramesToRecover: int32(27), // 3 invinsible frames for just-blown-up character to make a comeback

		JumpingInitVelY: int32(float64(7.5) * WORLD_TO_VIRTUAL_GRID_RATIO),

		SkillMapper: func(patternId int, currPlayerDownsync *PlayerDownsync) int {
			if 1 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover {
					if currPlayerDownsync.InAir {
						return 256
					} else {
						return 4
					}
				} else {
					// Now that "0 < FramesToRecover", we're only able to fire any skill if it's a cancellation
					if skillConfig, existent1 := skills[int(currPlayerDownsync.ActiveSkillId)]; existent1 {
						switch v := skillConfig.Hits[currPlayerDownsync.ActiveSkillHit].(type) {
						case *MeleeBullet:
							if v.CancellableStFrame <= currPlayerDownsync.FramesInChState && currPlayerDownsync.FramesInChState < v.CancellableEdFrame {
								if nextSkillId, existent2 := v.CancelTransit[patternId]; existent2 {
									return nextSkillId
								}
							}
						}
					}
				}
			}

			// By default no skill can be fired
			return NO_SKILL
		},
	},
}

var skills = map[int]*Skill{
	1: &Skill{
		RecoveryFrames:        int32(30),
		RecoveryFramesOnBlock: int32(30),
		RecoveryFramesOnHit:   int32(30),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK1,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(7),
					ActiveFrames:       int32(22),
					HitStunFrames:      int32(13),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(13),
					CancellableEdFrame: int32(30),

					CancelTransit: map[int]int{
						1: 2,
					},
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
		BoundChState:          ATK_CHARACTER_STATE_ATK2,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(18),
					ActiveFrames:       int32(18),
					HitStunFrames:      int32(18),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(18) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(22),
					CancellableEdFrame: int32(36),
					CancelTransit: map[int]int{
						1: 3,
					},
				},
			},
		},
	},
	3: &Skill{
		RecoveryFrames:        int32(60),
		RecoveryFramesOnBlock: int32(60),
		RecoveryFramesOnHit:   int32(60),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    int32(40),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
				},
			},
		},
	},
	4: &Skill{
		RecoveryFrames:        int32(30),
		RecoveryFramesOnBlock: int32(30),
		RecoveryFramesOnHit:   int32(30),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK1,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(7),
					ActiveFrames:       int32(22),
					HitStunFrames:      int32(13),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(13),
					CancellableEdFrame: int32(30),

					CancelTransit: map[int]int{
						1: 5,
					},
					// TODO: Use non-zero "selfLockVel"
				},
			},
		},
	},
	5: &Skill{
		RecoveryFrames:        int32(36),
		RecoveryFramesOnBlock: int32(36),
		RecoveryFramesOnHit:   int32(36),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK2,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:      int32(18),
					ActiveFrames:       int32(18),
					HitStunFrames:      int32(18),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					PushbackVelX:       int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:       int32(0),
					HitboxOffsetX:      int32(float64(18) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:      int32(0),
					HitboxSizeX:        int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:        int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					CancellableStFrame: int32(22),
					CancellableEdFrame: int32(36),
					CancelTransit: map[int]int{
						1: 6,
					},
				},
			},
		},
	},
	6: &Skill{
		RecoveryFrames:        int32(60),
		RecoveryFramesOnBlock: int32(60),
		RecoveryFramesOnHit:   int32(60),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    int32(40),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
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
		BoundChState:          ATK_CHARACTER_STATE_INAIR_ATK1,
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
	256: &Skill{
		RecoveryFrames:        int32(34),
		RecoveryFramesOnBlock: int32(34),
		RecoveryFramesOnHit:   int32(34),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_INAIR_ATK1,
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
