package models

import (
	"database/sql"
	. "server/common"
	"server/common/utils"
	"server/storage"

	sq "github.com/Masterminds/squirrel"
)

type PlayerLogin struct {
	CreatedAt    int64      `db:"created_at"`
	DeletedAt    NullInt64  `db:"deleted_at"`
	DisplayName  NullString `db:"display_name"`
	Avatar       string     `db:"avatar"`
	FromPublicIP NullString `db:"from_public_ip"`
	ID           int        `db:"id"`
	IntAuthToken string     `db:"int_auth_token"`
	PlayerID     int        `db:"player_id"`
	UpdatedAt    int64      `db:"updated_at"`
}

func (p *PlayerLogin) Insert() error {
	result, err := insert("player_login", []string{"created_at", "display_name",
		"from_public_ip", "int_auth_token", "player_id", "updated_at", "avatar"},
		[]interface{}{p.CreatedAt, p.DisplayName, p.FromPublicIP, p.IntAuthToken,
			p.PlayerID, p.UpdatedAt, p.Avatar})
	if err != nil {
		return err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	p.ID = int(id)
	return nil
}

func GetPlayerLoginByToken(token string) (*PlayerLogin, error) {
	var p PlayerLogin
	err := getObj("player_login",
		sq.Eq{"int_auth_token": token, "deleted_at": nil},
		&p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, nil
}

func GetPlayerLoginByPlayerId(playerId int) (*PlayerLogin, error) {
	var p PlayerLogin
	err := getObj("player_login",
		sq.Eq{"player_id": playerId, "deleted_at": nil},
		&p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, nil
}

func GetPlayerIdByToken(token string) (int, error) {
	var p PlayerLogin
	err := getFields("player_login", []string{"player_id"},
		sq.Eq{"int_auth_token": token, "deleted_at": nil},
		&p)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return p.PlayerID, nil
}

// TODO 封装到helper
func DelPlayerLoginByToken(token string) error {
	query, args, err := sq.Update("player_login").Set("deleted_at", utils.UnixtimeMilli()).
		Where(sq.Eq{"int_auth_token": token}).ToSql()
	if err != nil {
		return err
	}
	//Logger.Debug(query, args)
	_, err = storage.MySQLManagerIns.Exec(query, args...)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return err
	}
	return nil
}

func EnsuredPlayerLoginByToken(id int, token string) (bool, error) {
	return exist("player_login", sq.Eq{"int_auth_token": token, "deleted_at": nil, "player_id": id})
}

func EnsuredPlayerLoginById(id int) (bool, error) {
	return exist("player_login", sq.Eq{"player_id": id, "deleted_at": nil})
}

func CleanExpiredPlayerLoginToken() error {
	now := utils.UnixtimeMilli()
	max := now - int64(Constants.Player.IntAuthTokenTTLSeconds*1000)

	query, args, err := sq.Update("player_login").Set("deleted_at", now).
		Where(sq.LtOrEq{"created_at": max}).ToSql()
	if err != nil {
		return err
	}
	_, err = storage.MySQLManagerIns.Exec(query, args...)
	return err
}
