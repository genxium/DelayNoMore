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

	Speed                  int32
	JumpingInitVelY        int32
	JumpingFramesToRecover int32 // Not used yet

	DashingEnabled             bool
	OnWallEnabled              bool
	WallJumpingFramesToRecover int32
	WallJumpingInitVelX        int32
	WallJumpingInitVelY        int32
	WallSlidingVelY            int32

	InertiaFramesToRecover int32

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

		Speed:                  int32(float64(2.1) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingInitVelY:        int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingFramesToRecover: int32(2),

		InertiaFramesToRecover: int32(9),

		DashingEnabled:             true,
		OnWallEnabled:              true,
		WallJumpingFramesToRecover: int32(8),                                          // 8 would be the minimum for an avg human
		WallJumpingInitVelX:        int32(float64(2.8) * WORLD_TO_VIRTUAL_GRID_RATIO), // Default is "appeared facing right", but actually holding ctrl against left
		WallJumpingInitVelY:        int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
		WallSlidingVelY:            int32(float64(-1) * WORLD_TO_VIRTUAL_GRID_RATIO),

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
							if v.Bullet.CancellableStFrame <= currPlayerDownsync.FramesInChState && currPlayerDownsync.FramesInChState < v.Bullet.CancellableEdFrame {
								if nextSkillId, existent2 := v.Bullet.CancelTransit[patternId]; existent2 {
									return nextSkillId
								}
							}
						}
					}
				}
			} else if 3 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover && !currPlayerDownsync.InAir {
					return 15
				}
			} else if 5 == patternId {
				// Dashing is already constrained by "FramesToRecover & CapturedByInertia" in "deriveOpPattern"
				if !currPlayerDownsync.InAir {
					return 12
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

		Speed:                  int32(float64(2.19) * WORLD_TO_VIRTUAL_GRID_RATIO), // I don't know why "2.2" is so special that it throws a compile error
		JumpingInitVelY:        int32(float64(7.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingFramesToRecover: int32(2),

		InertiaFramesToRecover: int32(9),

		DashingEnabled:             true,
		OnWallEnabled:              true,
		WallJumpingFramesToRecover: int32(8),                                          // 8 would be the minimum for an avg human
		WallJumpingInitVelX:        int32(float64(2.8) * WORLD_TO_VIRTUAL_GRID_RATIO), // Default is "appeared facing right", but actually holding ctrl against left
		WallJumpingInitVelY:        int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
		WallSlidingVelY:            int32(float64(-1) * WORLD_TO_VIRTUAL_GRID_RATIO),

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
							if v.Bullet.CancellableStFrame <= currPlayerDownsync.FramesInChState && currPlayerDownsync.FramesInChState < v.Bullet.CancellableEdFrame {
								if nextSkillId, existent2 := v.Bullet.CancelTransit[patternId]; existent2 {
									return nextSkillId
								}
							}
						}
					}
				}
			} else if 3 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover && !currPlayerDownsync.InAir {
					return 16
				}
			} else if 5 == patternId {
				// Air dash allowed for this character
				// Dashing is already constrained by "FramesToRecover & CapturedByInertia" in "deriveOpPattern"
				return 13
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

		Speed:                  int32(float64(1.8) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingInitVelY:        int32(float64(7.8) * WORLD_TO_VIRTUAL_GRID_RATIO),
		JumpingFramesToRecover: int32(2),

		InertiaFramesToRecover: int32(9),

		DashingEnabled: true,
		OnWallEnabled:  false,

		SkillMapper: func(patternId int, currPlayerDownsync *PlayerDownsync) int {
			if 1 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover {
					if currPlayerDownsync.InAir {
						return 257
					} else {
						return 7
					}
				} else {
					// Now that "0 < FramesToRecover", we're only able to fire any skill if it's a cancellation
					if skillConfig, existent1 := skills[int(currPlayerDownsync.ActiveSkillId)]; existent1 {
						switch v := skillConfig.Hits[currPlayerDownsync.ActiveSkillHit].(type) {
						case *MeleeBullet:
							if v.Bullet.CancellableStFrame <= currPlayerDownsync.FramesInChState && currPlayerDownsync.FramesInChState < v.Bullet.CancellableEdFrame {
								if nextSkillId, existent2 := v.Bullet.CancelTransit[patternId]; existent2 {
									return nextSkillId
								}
							}
						}
					}
				}
			} else if 2 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover && !currPlayerDownsync.InAir {
					return 11
				}
			} else if 3 == patternId {
				if 0 == currPlayerDownsync.FramesToRecover && !currPlayerDownsync.InAir {
					return 10
				}
			} else if 5 == patternId {
				// Dashing is already constrained by "FramesToRecover & CapturedByInertia" in "deriveOpPattern"
				if !currPlayerDownsync.InAir {
					return 14
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
				Bullet: &BulletConfig{
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
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
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
				Bullet: &BulletConfig{
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
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
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
				Bullet: &BulletConfig{
					StartupFrames:   int32(8),
					ActiveFrames:    int32(30),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(float64(5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(16) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
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
				Bullet: &BulletConfig{
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
					BlowUp:          false,
					ExplosionFrames: 15,
					SpeciesId:       int32(2),
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
				Bullet: &BulletConfig{
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
					CancellableStFrame: int32(23),
					CancellableEdFrame: int32(36),
					CancelTransit: map[int]int{
						1: 6,
					},
					BlowUp:          false,
					ExplosionFrames: 15,
					SpeciesId:       int32(2),
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
				Bullet: &BulletConfig{
					StartupFrames:   int32(8),
					ActiveFrames:    int32(28),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(3) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
					ExplosionFrames: 15,
					SpeciesId:       int32(2),
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
				Bullet: &BulletConfig{
					StartupFrames:      int32(7),
					ActiveFrames:       int32(22),
					HitStunFrames:      int32(13),
					BlockStunFrames:    int32(9),
					Damage:             int32(5),
					SelfLockVelX:       NO_LOCK_VEL,
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
						1: 8,
					},
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
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
				Bullet: &BulletConfig{
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
						1: 9,
					},
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
				},
			},
		},
	},
	9: &Skill{
		RecoveryFrames:        int32(40),
		RecoveryFramesOnBlock: int32(40),
		RecoveryFramesOnHit:   int32(40),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK3,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: &BulletConfig{
					StartupFrames:   int32(7),
					ActiveFrames:    int32(30),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(10),
					SelfLockVelX:    int32(float64(1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(4) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(10) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
				},
			},
		},
	},
	10: &Skill{
		RecoveryFrames:        int32(38),
		RecoveryFramesOnBlock: int32(38),
		RecoveryFramesOnHit:   int32(38),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK4,
		Hits: []interface{}{
			&FireballBullet{
				Speed: int32(float64(6) * WORLD_TO_VIRTUAL_GRID_RATIO),
				Bullet: &BulletConfig{
					StartupFrames:   int32(10),
					ActiveFrames:    MAX_INT32,
					HitStunFrames:   int32(15),
					BlockStunFrames: int32(9),
					Damage:          int32(22),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(0),
					HitboxOffsetX:   int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(float64(10) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeX:     int32(float64(64) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          false,
					ExplosionFrames: 30,
					SpeciesId:       int32(1),
				},
			},
		},
	},
	11: &Skill{
		RecoveryFrames:        int32(60),
		RecoveryFramesOnBlock: int32(60),
		RecoveryFramesOnHit:   int32(60),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK5,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: &BulletConfig{
					StartupFrames:   int32(3),
					ActiveFrames:    int32(25),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(35),
					SelfLockVelX:    int32(float64(1) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelX:    int32(float64(2) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(40) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(64) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
					ExplosionFrames: 15,
					SpeciesId:       int32(3),
				},
			},
		},
	},
	12: &Skill{
		RecoveryFrames:        int32(10),
		RecoveryFramesOnBlock: int32(10),
		RecoveryFramesOnHit:   int32(10),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_DASHING,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: &BulletConfig{
					StartupFrames:   int32(3),
					ActiveFrames:    int32(0),
					HitStunFrames:   int32(0),
					BlockStunFrames: int32(0),
					Damage:          int32(0),
					SelfLockVelX:    int32(float64(6) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(0),
					PushbackVelX:    NO_LOCK_VEL,
					PushbackVelY:    NO_LOCK_VEL,
					HitboxOffsetX:   int32(0),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(0),
					HitboxSizeY:     int32(0),
					BlowUp:          false,
				},
			},
		},
	},
	13: &Skill{
		RecoveryFrames:        int32(12),
		RecoveryFramesOnBlock: int32(12),
		RecoveryFramesOnHit:   int32(12),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_DASHING,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: &BulletConfig{
					StartupFrames:   int32(3),
					ActiveFrames:    int32(0),
					HitStunFrames:   int32(0),
					BlockStunFrames: int32(0),
					Damage:          int32(0),
					SelfLockVelX:    int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(0),
					PushbackVelX:    NO_LOCK_VEL,
					PushbackVelY:    NO_LOCK_VEL,
					HitboxOffsetX:   int32(0),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(0),
					HitboxSizeY:     int32(0),
					BlowUp:          false,
				},
			},
		},
	},
	14: &Skill{
		RecoveryFrames:        int32(8),
		RecoveryFramesOnBlock: int32(8),
		RecoveryFramesOnHit:   int32(8),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_DASHING,
		Hits: []interface{}{
			&MeleeBullet{
				Bullet: &BulletConfig{
					StartupFrames:   int32(4),
					ActiveFrames:    int32(0),
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(0),
					Damage:          int32(0),
					SelfLockVelX:    int32(float64(5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					SelfLockVelY:    int32(0),
					PushbackVelX:    NO_LOCK_VEL,
					PushbackVelY:    NO_LOCK_VEL,
					HitboxOffsetX:   int32(0),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(0),
					HitboxSizeY:     int32(0),
					BlowUp:          false,
				},
			},
		},
	},
	15: &Skill{
		RecoveryFrames:        int32(48),
		RecoveryFramesOnBlock: int32(48),
		RecoveryFramesOnHit:   int32(48),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK4,
		Hits: []interface{}{
			&FireballBullet{
				Speed: int32(float64(4) * WORLD_TO_VIRTUAL_GRID_RATIO),
				Bullet: &BulletConfig{
					StartupFrames:   int32(12),
					ActiveFrames:    MAX_INT32,
					HitStunFrames:   int32(15),
					BlockStunFrames: int32(9),
					Damage:          int32(18),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(3) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(0),
					HitboxOffsetX:   int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeX:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          false,
					ExplosionFrames: 30,
					SpeciesId:       int32(2),
				},
			},
		},
	},
	16: &Skill{
		RecoveryFrames:        int32(60),
		RecoveryFramesOnBlock: int32(60),
		RecoveryFramesOnHit:   int32(60),
		ReleaseTriggerType:    int32(1),
		BoundChState:          ATK_CHARACTER_STATE_ATK4,
		Hits: []interface{}{
			&FireballBullet{
				Speed: int32(float64(4) * WORLD_TO_VIRTUAL_GRID_RATIO),
				Bullet: &BulletConfig{
					StartupFrames:   int32(16),
					ActiveFrames:    MAX_INT32,
					HitStunFrames:   MAX_INT32,
					BlockStunFrames: int32(9),
					Damage:          int32(30),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(3) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(float64(7) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetX:   int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(float64(8) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeX:     int32(float64(48) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          true,
					ExplosionFrames: 30,
					SpeciesId:       int32(3),
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
				Bullet: &BulletConfig{
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
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
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
				Bullet: &BulletConfig{
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
					BlowUp:          false,
					ExplosionFrames: 15,
					SpeciesId:       int32(2),
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
				Bullet: &BulletConfig{
					StartupFrames:   int32(4),
					ActiveFrames:    int32(20),
					HitStunFrames:   int32(9),
					BlockStunFrames: int32(5),
					Damage:          int32(5),
					SelfLockVelX:    NO_LOCK_VEL,
					SelfLockVelY:    NO_LOCK_VEL,
					PushbackVelX:    int32(float64(0.5) * WORLD_TO_VIRTUAL_GRID_RATIO),
					PushbackVelY:    int32(0),
					HitboxOffsetX:   int32(float64(12) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxOffsetY:   int32(0),
					HitboxSizeX:     int32(float64(32) * WORLD_TO_VIRTUAL_GRID_RATIO),
					HitboxSizeY:     int32(float64(24) * WORLD_TO_VIRTUAL_GRID_RATIO),
					BlowUp:          false,
					ExplosionFrames: 9,
					SpeciesId:       int32(1),
				},
			},
		},
	},
}
