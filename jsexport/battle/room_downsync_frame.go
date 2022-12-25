package battle

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
	ColliderRadius    float64
	Removed           bool
	Score             int32
	LastMoveGmtMillis int32
	FramesToRecover   int32
	Hp                int32
	MaxHp             int32
	CharacterState    int32
	InAir             bool
	Name              string
	DisplayName       string
	Avatar            string
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

type MeleeBullet struct {
	// for offender
	BattleLocalId           int32
	StartupFrames           int32
	ActiveFrames            int32
	RecoveryFrames          int32
	RecoveryFramesOnBlock   int32
	RecoveryFramesOnHit     int32
	Moveforward             *Vec2D
	HitboxOffset            float64
	HitboxSize              *Vec2D
	OriginatedRenderFrameId int32
	// for defender
	HitStunFrames      int32
	BlockStunFrames    int32
	Pushback           float64
	ReleaseTriggerType int32
	Damage             int32
	OffenderJoinIndex  int32
	OffenderPlayerId   int32
}

type RoomDownsyncFrame struct {
	Id                     int32
	PlayersArr             []*PlayerDownsync
	CountdownNanos         int64
	MeleeBullets           []*MeleeBullet
	BackendUnconfirmedMask uint64
	ShouldForceResync      bool
	Players                map[int32]*PlayerDownsync
}
