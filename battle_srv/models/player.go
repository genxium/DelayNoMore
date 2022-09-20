package models

import (
	"database/sql"
	"fmt"
	"github.com/ByteArena/box2d"
	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
)

type PlayerBattleState struct {
	ADDED_PENDING_BATTLE_COLLIDER_ACK   int32
	READDED_PENDING_BATTLE_COLLIDER_ACK int32
	ACTIVE                              int32
	DISCONNECTED                        int32
	LOST                                int32
	EXPELLED_DURING_GAME                int32
	EXPELLED_IN_DISMISSAL               int32
}

var PlayerBattleStateIns PlayerBattleState

func InitPlayerBattleStateIns() {
	PlayerBattleStateIns = PlayerBattleState{
		ADDED_PENDING_BATTLE_COLLIDER_ACK:   0,
		READDED_PENDING_BATTLE_COLLIDER_ACK: 1,
		ACTIVE:                              2,
		DISCONNECTED:                        3,
		LOST:                                4,
		EXPELLED_DURING_GAME:                5,
		EXPELLED_IN_DISMISSAL:               6,
	}
}

type Player struct {
	Id                int32      `json:"id,omitempty" db:"id"`
	X                 float64    `json:"x,omitempty"`
	Y                 float64    `json:"y,omitempty"`
	Dir               *Direction `json:"dir,omitempty"`
	Speed             int32      `json:"speed,omitempty"`
	BattleState       int32      `json:"battleState,omitempty"`
	LastMoveGmtMillis int32      `json:"lastMoveGmtMillis,omitempty"`
	Score             int32      `json:"score,omitempty"`
	Removed           bool       `json:"removed,omitempty"`
	JoinIndex         int32

	Name        string `json:"name,omitempty" db:"name"`
	DisplayName string `json:"displayName,omitempty" db:"display_name"`
	Avatar      string `json:"avatar,omitempty"`

	FrozenAtGmtMillis    int64         `json:"-" db:"-"`
	AddSpeedAtGmtMillis  int64         `json:"-" db:"-"`
	CreatedAt            int64         `json:"-" db:"created_at"`
	UpdatedAt            int64         `json:"-" db:"updated_at"`
	DeletedAt            NullInt64     `json:"-" db:"deleted_at"`
	TutorialStage        int           `json:"-" db:"tutorial_stage"`
	CollidableBody       *box2d.B2Body `json:"-"`
	AckingFrameId        int32         `json:"ackingFrameId"`
	AckingInputFrameId   int32         `json:"-"`
	LastSentInputFrameId int32         `json:"-"`
}

func ExistPlayerByName(name string) (bool, error) {
	return exist("player", sq.Eq{"name": name, "deleted_at": nil})
}

func GetPlayerByName(name string) (*Player, error) {
	return getPlayer(sq.Eq{"name": name, "deleted_at": nil})
}

func GetPlayerById(id int) (*Player, error) {
	return getPlayer(sq.Eq{"id": id, "deleted_at": nil})
}

func getPlayer(cond sq.Eq) (*Player, error) {
	var p Player
	err := getObj("player", cond, &p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	p.Dir = &Direction{
		Dx: 0,
		Dy: 0,
	}
	return &p, nil
}

func (p *Player) Insert(tx *sqlx.Tx) error {
	result, err := txInsert(tx, "player", []string{"name", "display_name", "created_at", "updated_at", "avatar"},
		[]interface{}{p.Name, p.DisplayName, p.CreatedAt, p.UpdatedAt, p.Avatar})
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.Id = int32(id)
	return nil
}

func Update(tx *sqlx.Tx, id int32, p *Player) (bool, error) {
	query, args, err := sq.Update("player").
		Set("display_name", p.DisplayName).
		Set("avatar", p.Avatar).
		Where(sq.Eq{"id": id}).ToSql()

	fmt.Println(query)

	if err != nil {
		return false, err
	}
	result, err := tx.Exec(query, args...)
	if err != nil {
		fmt.Println("ERRRRRRR:  ")
		fmt.Println(err)
		return false, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected >= 1, nil
}

func UpdatePlayerTutorialStage(tx *sqlx.Tx, id int) (bool, error) {
	query, args, err := sq.Update("player").
		Set("tutorial_stage", 1).
		Where(sq.Eq{"tutorial_stage": 0, "id": id}).ToSql()
	if err != nil {
		return false, err
	}
	result, err := tx.Exec(query, args...)
	if err != nil {
		return false, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}
	return rowsAffected >= 1, nil
}
