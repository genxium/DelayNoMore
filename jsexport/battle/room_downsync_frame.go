package battle

// TODO: Replace all "int32", "int64", "uint32" and "uint64" with just "int" for better performance in JavaScript! Reference https://github.com/gopherjs/gopherjs#performance-tips

type Vec2D struct {
	X float64
	Y float64
}

type Polygon2D struct {
	Anchor *Vec2D
	Points []*Vec2D
}

type PlayerDownsync struct {
	Id                int32
	VirtualGridX      int32
	VirtualGridY      int32
	DirX              int32
	DirY              int32
	VelX              int32
	VelY              int32
	Speed             int32
	BattleState       int32
	JoinIndex         int32
	ColliderRadius    int32
	Removed           bool
	Score             int32
	LastMoveGmtMillis int32
	FramesToRecover   int32
	FramesInChState   int32
	Hp                int32
	MaxHp             int32
	CharacterState    int32
	InAir             bool
	OnWall            bool
	OnWallNormX       int32
	OnWallNormY       int32

	CapturedByInertia bool

	ActiveSkillId  int32
	ActiveSkillHit int32

	FramesInvinsible int32

	BulletTeamId      int32
	ChCollisionTeamId int32 // not the same as "BulletTeamId", because even in the same team, we should allow inter-character collisions
}

type InputFrameDecoded struct {
	Dx        int32
	Dy        int32
	BtnALevel int32
	BtnBLevel int32
}

type InputFrameUpsync struct {
	InputFrameId int32
	Encoded      uint64
}

type Barrier struct {
	Boundary *Polygon2D
}

type BulletConfig struct {
	StartupFrames      int32 // from "OriginatedRenderFrameId"
	CancellableStFrame int32 // from "OriginatedRenderFrameId"
	CancellableEdFrame int32 // from "OriginatedRenderFrameId"
	ActiveFrames       int32

	// for defender
	HitStunFrames   int32
	BlockStunFrames int32
	PushbackVelX    int32
	PushbackVelY    int32
	Damage          int32

	SelfLockVelX int32
	SelfLockVelY int32

	HitboxOffsetX int32
	HitboxOffsetY int32
	HitboxSizeX   int32
	HitboxSizeY   int32

	BlowUp          bool
	ExplosionFrames int32
	SpeciesId       int32 // For fireball, this SpeciesId specifies both the active animation and the explosion animation, for melee it specifies the explosion animation

	CancelTransit map[int]int
}

type BulletBattleAttr struct {
	BulletLocalId int32 // for referencing cached nodes in frontend rendering

	// for offender
	OriginatedRenderFrameId int32 // Copied from the first bullet for all subsequent bullets
	OffenderJoinIndex       int32 // Copied to favor collision handling of the dispatched bullet
	TeamId                  int32
}

type MeleeBullet struct {
	BlState         int32 // bullet state, e.g. STARTUP, ACTIVE, EXPLODING
	FramesInBlState int32
	BattleAttr      *BulletBattleAttr
	Bullet          *BulletConfig
}

type FireballBullet struct {
	VirtualGridX    int32
	VirtualGridY    int32
	DirX            int32
	DirY            int32
	VelX            int32
	VelY            int32
	Speed           int32
	BlState         int32 // bullet state, e.g. STARTUP, ACTIVE, EXPLODING
	FramesInBlState int32
	BattleAttr      *BulletBattleAttr
	Bullet          *BulletConfig
}

type Skill struct {
	BattleLocalId         int32
	RecoveryFrames        int32
	RecoveryFramesOnBlock int32
	RecoveryFramesOnHit   int32
	ReleaseTriggerType    int32 // 1: rising-edge, 2: falling-edge
	BoundChState          int32
	Hits                  []interface{} // Hits within a "Skill" are automatically triggered
	// [WARN] Multihit of a fireball is more difficult to handle than that of melee, because we have to count from the fireball's first hit; the situation becomes even more complicated when a multihit fireball is in a crowd -- remains to be designed
}

type RoomDownsyncFrame struct {
	Id                     int32
	PlayersArr             []*PlayerDownsync
	CountdownNanos         int64
	MeleeBullets           []*MeleeBullet
	FireballBullets        []*FireballBullet
	BackendUnconfirmedMask uint64
	ShouldForceResync      bool

	BulletLocalIdCounter int32
}

type InputFrameDownsync struct {
	InputFrameId  int32
	InputList     []uint64
	ConfirmedList uint64
}

type NpcPatrolCue struct {
	FlAct uint64 // Encoded input when collided with this cue & facing left
	FrAct uint64 // Encoded input when collided with this cue & facing right
	X     float64
	Y     float64
}
