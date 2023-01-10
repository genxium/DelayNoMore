package battle

type SkillMapperType func(patternId int, currPlayerDownsync *PlayerDownsync) int

type CharacterConfig struct {
	SpeciesId   int
	SpeciesName string

	InAirIdleFrameIdxTurningPoint int
	InAirIdleFrameIdxTurnedCycle  int

	LayDownFrames          int32
	LayDownFramesToRecover int32

	GetUpInvinsibleFrames int32
	GetUpFramesToRecover  int32

	Speed           int32
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

		GetUpInvinsibleFrames: int32(10),
		GetUpFramesToRecover:  int32(27),

		Speed:           int32(float64(1.2) * WORLD_TO_VIRTUAL_GRID_RATIO),
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

		GetUpInvinsibleFrames: int32(10),
		GetUpFramesToRecover:  int32(27),

		Speed:           int32(float64(1.4) * WORLD_TO_VIRTUAL_GRID_RATIO),
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
	4096: &CharacterConfig{
		SpeciesId:   4096,
		SpeciesName: "Monk",

		InAirIdleFrameIdxTurningPoint: 42,
		InAirIdleFrameIdxTurnedCycle:  2,

		LayDownFrames:          int32(14),
		LayDownFramesToRecover: int32(14),

		GetUpInvinsibleFrames: int32(8),
		GetUpFramesToRecover:  int32(30),

		Speed:           int32(float64(1.0) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingInitVelY: int32(float64(9) * WORLD_TO_VIRTUAL_GRID_RATIO),

		SkillMapper: func(patternId int, currPlayerDownsync *PlayerDownsync) int {
			if 1 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover {
					if currPlayerDownsync.InAir {
						return 257
					} else {
						return 10
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
					SelfLockVelX:       int32(float64(0.05) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
					SelfLockVelX:       int32(float64(0.1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
		RecoveryFrames:        int32(50),
		RecoveryFramesOnBlock: int32(50),
		RecoveryFramesOnHit:   int32(50),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    int32(30),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(float64(5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
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
					SelfLockVelX:       int32(float64(0.05) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
					SelfLockVelX:       int32(float64(0.1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
		RecoveryFrames:        int32(45),
		RecoveryFramesOnBlock: int32(45),
		RecoveryFramesOnHit:   int32(45),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    int32(28),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    int32(float64(-0.1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    NO_LOCK_VEL,
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
	7: &Skill{
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
					SelfLockVelX:       int32(float64(0.05) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
	8: &Skill{
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
					SelfLockVelX:       int32(float64(0.1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:       NO_LOCK_VEL,
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
	9: &Skill{
		RecoveryFrames:        int32(50),
		RecoveryFramesOnBlock: int32(50),
		RecoveryFramesOnHit:   int32(50),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    int32(30),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(float64(5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
				},
			},
		},
	},
	10: &Skill{
		RecoveryFrames:        int32(40),
		RecoveryFramesOnBlock: int32(40),
		RecoveryFramesOnHit:   int32(40),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK4,
		Hits: []interface{}{
			&FireballBullet{
				Speed: int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
				Bullet: Bullet{
					StartupFrames:   int32(15),
					ActiveFrames:    MAX_INT32,
					HitStunFrames:   int32(15),
					BlockStunFrames: int32(9),
					Damage:          int32(20),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(0),
					HitboxOffsetX:   int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
				},
			},
		},
	},
	255: &Skill{
		RecoveryFrames:        int32(30),
		RecoveryFramesOnBlock: int32(30),
		RecoveryFramesOnHit:   int32(30),
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
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
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
		RecoveryFrames:        int32(20),
		RecoveryFramesOnBlock: int32(20),
		RecoveryFramesOnHit:   int32(20),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_INAIR_ATK1,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: Bullet{
					StartupFrames:   int32(3),
					ActiveFrames:    int32(10),
					HitStunFrames:   int32(15),
					BlockStunFrames: int32(9),
					Damage:          int32(5),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
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
	257: &Skill{
		RecoveryFrames:        int32(30),
		RecoveryFramesOnBlock: int32(30),
		RecoveryFramesOnHit:   int32(30),
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
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
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
