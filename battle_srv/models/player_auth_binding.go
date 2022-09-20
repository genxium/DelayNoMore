package models

import (
	"database/sql"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
)

type PlayerAuthBinding struct {
	Channel   int       `db:"channel"`
	CreatedAt int64     `db:"created_at"`
	DeletedAt NullInt64 `db:"deleted_at"`
	ExtAuthID string    `db:"ext_auth_id"`
	PlayerID  int       `db:"player_id"`
	UpdatedAt int64     `db:"updated_at"`
}

func (p *PlayerAuthBinding) Insert(tx *sqlx.Tx) error {
	_, err := txInsert(tx, "player_auth_binding", []string{"channel", "created_at", "ext_auth_id",
		"player_id", "updated_at"},
		[]interface{}{p.Channel, p.CreatedAt, p.ExtAuthID, p.PlayerID, p.UpdatedAt})
	return err
}

func GetPlayerAuthBinding(channel int, extAuthID string) (*PlayerAuthBinding, error) {
	var p PlayerAuthBinding
	err := getObj("player_auth_binding",
		sq.Eq{"channel": channel, "ext_auth_id": extAuthID, "deleted_at": nil},
		&p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, nil
}
