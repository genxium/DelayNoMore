package battle

// CharacterConfig
func (c *CharacterConfig) GetSpeed() int32 {
	return c.Speed
}
func (c *CharacterConfig) GetSpeciesId() int {
	return c.SpeciesId
}
func (c *CharacterConfig) GetSpeciesName() string {
	return c.SpeciesName
}

// InputFrameDownsync
func (ifd *InputFrameDownsync) GetInputFrameId() int32 {
	return ifd.InputFrameId
}

func (ifd *InputFrameDownsync) GetInputList() []uint64 {
	return ifd.InputList
}

func (ifd *InputFrameDownsync) GetConfirmedList() uint64 {
	return ifd.ConfirmedList
}

// PlayerDownsync
func (p *PlayerDownsync) GetId() int32 {
	return p.Id
}

func (p *PlayerDownsync) GetJoinIndex() int32 {
	return p.JoinIndex
}

func (p *PlayerDownsync) GetVirtualGridX() int32 {
	return p.VirtualGridX
}

func (p *PlayerDownsync) GetVirtualGridY() int32 {
	return p.VirtualGridY
}

func (p *PlayerDownsync) GetDirX() int32 {
	return p.DirX
}

func (p *PlayerDownsync) GetDirY() int32 {
	return p.DirY
}

func (p *PlayerDownsync) GetVelX() int32 {
	return p.VelX
}

func (p *PlayerDownsync) GetVelY() int32 {
	return p.VelY
}

func (p *PlayerDownsync) GetSpeed() int32 {
	return p.Speed
}

func (p *PlayerDownsync) GetHp() int32 {
	return p.Hp
}

func (p *PlayerDownsync) GetMaxHp() int32 {
	return p.MaxHp
}

func (p *PlayerDownsync) GetCharacterState() int32 {
	return p.CharacterState
}

func (p *PlayerDownsync) GetFramesToRecover() int32 {
	return p.FramesToRecover
}

func (p *PlayerDownsync) GetFramesInChState() int32 {
	return p.FramesInChState
}

func (p *PlayerDownsync) GetInAir() bool {
	return p.InAir
}

func (p *PlayerDownsync) GetOnWall() bool {
	return p.OnWall
}

func (p *PlayerDownsync) GetOnWallNormX() int32 {
	return p.OnWallNormX
}

func (p *PlayerDownsync) GetColliderRadius() int32 {
	return p.ColliderRadius
}

// MeleeBullet
func (b *MeleeBullet) GetBlState() int32 {
	return b.BlState
}

func (b *MeleeBullet) GetFramesInBlState() int32 {
	return b.FramesInBlState
}

func (b *MeleeBullet) GetBulletLocalId() int32 {
	return b.BattleAttr.BulletLocalId
}

func (b *MeleeBullet) GetOffenderJoinIndex() int32 {
	return b.BattleAttr.OffenderJoinIndex
}

func (b *MeleeBullet) GetOriginatedRenderFrameId() int32 {
	return b.BattleAttr.OriginatedRenderFrameId
}

func (b *MeleeBullet) GetStartupFrames() int32 {
	return b.Bullet.StartupFrames
}

func (b *MeleeBullet) GetActiveFrames() int32 {
	return b.Bullet.ActiveFrames
}

func (b *MeleeBullet) GetHitboxSizeX() int32 {
	return b.Bullet.HitboxSizeX
}

func (b *MeleeBullet) GetHitboxSizeY() int32 {
	return b.Bullet.HitboxSizeY
}

func (b *MeleeBullet) GetHitboxOffsetX() int32 {
	return b.Bullet.HitboxOffsetX
}

func (b *MeleeBullet) GetHitboxOffsetY() int32 {
	return b.Bullet.HitboxOffsetY
}

func (b *MeleeBullet) GetExplosionFrames() int32 {
	return b.Bullet.ExplosionFrames
}

func (b *MeleeBullet) GetSpeciesId() int32 {
	return b.Bullet.SpeciesId
}

// FireballBullet
func (p *FireballBullet) GetVirtualGridX() int32 {
	return p.VirtualGridX
}

func (p *FireballBullet) GetVirtualGridY() int32 {
	return p.VirtualGridY
}

func (p *FireballBullet) GetDirX() int32 {
	return p.DirX
}

func (p *FireballBullet) GetDirY() int32 {
	return p.DirY
}

func (p *FireballBullet) GetVelX() int32 {
	return p.VelX
}

func (p *FireballBullet) GetVelY() int32 {
	return p.VelY
}

func (p *FireballBullet) GetSpeed() int32 {
	return p.Speed
}
func (b *FireballBullet) GetBlState() int32 {
	return b.BlState
}

func (b *FireballBullet) GetFramesInBlState() int32 {
	return b.FramesInBlState
}

func (b *FireballBullet) GetBulletLocalId() int32 {
	return b.BattleAttr.BulletLocalId
}

func (b *FireballBullet) GetOffenderJoinIndex() int32 {
	return b.BattleAttr.OffenderJoinIndex
}

func (b *FireballBullet) GetOriginatedRenderFrameId() int32 {
	return b.BattleAttr.OriginatedRenderFrameId
}

func (b *FireballBullet) GetStartupFrames() int32 {
	return b.Bullet.StartupFrames
}

func (b *FireballBullet) GetActiveFrames() int32 {
	return b.Bullet.ActiveFrames
}

func (b *FireballBullet) GetHitboxSizeX() int32 {
	return b.Bullet.HitboxSizeX
}

func (b *FireballBullet) GetHitboxSizeY() int32 {
	return b.Bullet.HitboxSizeY
}

func (b *FireballBullet) GetHitboxOffsetX() int32 {
	return b.Bullet.HitboxOffsetX
}

func (b *FireballBullet) GetHitboxOffsetY() int32 {
	return b.Bullet.HitboxOffsetY
}

func (b *FireballBullet) GetExplosionFrames() int32 {
	return b.Bullet.ExplosionFrames
}

func (b *FireballBullet) GetSpeciesId() int32 {
	return b.Bullet.SpeciesId
}

// RoomDownsyncFrame
func (r *RoomDownsyncFrame) GetId() int32 {
	return r.Id
}

func (r *RoomDownsyncFrame) GetCountdownNanos() int64 {
	return r.CountdownNanos
}

func (r *RoomDownsyncFrame) GetBackendUnconfirmedMask() uint64 {
	return r.BackendUnconfirmedMask
}

func (r *RoomDownsyncFrame) GetBulletLocalIdCounter() int32 {
	return r.BulletLocalIdCounter
}

func (r *RoomDownsyncFrame) GetShouldForceResync() bool {
	return r.ShouldForceResync
}

func (r *RoomDownsyncFrame) GetPlayersArr() []*PlayerDownsync {
	return r.PlayersArr
}

func (r *RoomDownsyncFrame) GetMeleeBullets() []*MeleeBullet {
	return r.MeleeBullets
}

func (r *RoomDownsyncFrame) GetFireballBullets() []*FireballBullet {
	return r.FireballBullets
}
