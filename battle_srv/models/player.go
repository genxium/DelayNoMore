package models

import (
	. "battle_srv/protos"
	"battle_srv/storage"
	. "dnmshared"
	"fmt"
	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
	"net"
)

type PlayerBattleState struct {
	ADDED_PENDING_BATTLE_COLLIDER_ACK   int32
	READDED_PENDING_BATTLE_COLLIDER_ACK int32
	READDED_BATTLE_COLLIDER_ACKED       int32
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
		READDED_BATTLE_COLLIDER_ACKED:       2,
		ACTIVE:                              3,
		DISCONNECTED:                        4,
		LOST:                                5,
		EXPELLED_DURING_GAME:                6,
		EXPELLED_IN_DISMISSAL:               7,
	}
}

type Player struct {
	PlayerDownsync

	// DB only fields
	CreatedAt     int64     `db:"created_at"`
	UpdatedAt     int64     `db:"updated_at"`
	DeletedAt     NullInt64 `db:"deleted_at"`
	TutorialStage int       `db:"tutorial_stage"`

	// other in-battle info fields
	LastReceivedInputFrameId    int32
	LastUdpReceivedInputFrameId int32
	LastSentInputFrameId        int32
	AckingFrameId               int32
	AckingInputFrameId          int32

	UdpAddr                *PeerUdpAddr
	BattleUdpTunnelAddr    *net.UDPAddr // This addr is used by backend only, not visible to frontend
	BattleUdpTunnelAuthKey int32
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
	p := Player{}
	pd := PlayerDownsync{}
	query, args, err := sq.Select("*").From("player").Where(cond).Limit(1).ToSql()
	if err != nil {
		return nil, err
	}
	rows, err := storage.MySQLManagerIns.Queryx(query, args...)
	if err != nil {
		return nil, err
	}
	cols, err := rows.Columns()
	if nil != err {
		panic(err)
	}
	for rows.Next() {
		// TODO: Do it more elegantly, but by now I don't have time to learn reflection of Golang
		vals := rowValues(rows, cols)
		for i, col := range cols {
			val := *vals[i].(*interface{})
			if "id" == col {
				pd.Id = int32(val.(int64))
			}
			if "name" == col {
				switch v := val.(type) {
				case []byte:
					pd.Name = string(v)
				default:
					pd.Name = fmt.Sprintf("%v", v)
				}
			}
			if "created_at" == col {
				p.CreatedAt = int64(val.(int64))
			}
		}
		Logger.Debug("Queried player from db", zap.Any("cond", cond), zap.Any("p", p), zap.Any("pd", pd), zap.Any("cols", cols), zap.Any("rowValues", vals))
	}
	p.PlayerDownsync = pd
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
