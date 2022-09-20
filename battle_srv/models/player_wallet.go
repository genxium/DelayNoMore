package models

import (
	"database/sql"
	"errors"
	. "server/common"
	"server/common/utils"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

type PlayerWallet struct {
	CreatedAt int64     `json:"-" db:"created_at"`
	DeletedAt NullInt64 `json:"-" db:"deleted_at"`
	Gem       int       `json:"gem" db:"gem"`
	ID        int       `json:"-" db:"id"`
	UpdatedAt int64     `json:"-" db:"updated_at"`
}

func (p *PlayerWallet) Insert(tx *sqlx.Tx) error {
	_, err := txInsert(tx, "player_wallet", []string{"id", "created_at", "updated_at"},
		[]interface{}{p.ID, p.CreatedAt, p.UpdatedAt})
	return err
}

func GetPlayerWalletById(id int) (*PlayerWallet, error) {
	var p PlayerWallet
	err := getObj("player_wallet", sq.Eq{"id": id, "deleted_at": nil}, &p)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &p, nil
}

func CostPlayerWallet(tx *sqlx.Tx, id int, currency int, val int) (int, error) {
	var column string
	switch currency {
	case Constants.Player.Diamond:
		column = "diamond"
	case Constants.Player.Energy:
		column = "energy"
	case Constants.Player.Gold:
		column = "gold"
	}
	if column == "" {
		Logger.Debug("CostPlayerWallet Error Currency",
			zap.Int("currency", currency), zap.Int("val", val))
		return Constants.RetCode.MysqlError, errors.New("error currency")
	}

	now := utils.UnixtimeMilli()
	query, args, err := sq.Update("player_wallet").
		Set(column, sq.Expr(column+"-?", val)).Set("updated_at", now).
		Where(sq.Eq{"id": id, "deleted_at": nil}).
		Where(sq.GtOrEq{column: val}).ToSql()

	Logger.Debug("CostPlayerWallet", zap.String("sql", query), zap.Any("args", args))
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	result, err := tx.Exec(query, args...)
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	ok := rowsAffected >= 1
	Logger.Debug("CostPlayerWallet", zap.Int64("rowsAffected", rowsAffected),
		zap.Bool("cost", ok))
	if !ok {
		var ret int
		switch currency {
		case Constants.Player.Diamond:
			ret = Constants.RetCode.LackOfDiamond
		case Constants.Player.Energy:
			ret = Constants.RetCode.LackOfEnergy
		case Constants.Player.Gold:
			ret = Constants.RetCode.LackOfGold
		}
		return ret, nil
	}
	return 0, nil
}

func AddPlayerWallet(tx *sqlx.Tx, id int, currency int, val int) (int, error) {
	var column string
	switch currency {
	case Constants.Player.Diamond:
		column = "diamond"
	case Constants.Player.Energy:
		column = "energy"
	case Constants.Player.Gold:
		column = "gold"
	}
	if column == "" {
		Logger.Debug("CostPlayerWallet Error Currency",
			zap.Int("currency", currency), zap.Int("val", val))
		return Constants.RetCode.MysqlError, errors.New("error currency")
	}

	now := utils.UnixtimeMilli()
	query, args, err := sq.Update("player_wallet").
		Set(column, sq.Expr(column+"+?", val)).Set("updated_at", now).
		Where(sq.Eq{"id": id, "deleted_at": nil}).ToSql()

	Logger.Debug("AddPlayerWallet", zap.String("sql", query), zap.Any("args", args))
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	result, err := tx.Exec(query, args...)
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Constants.RetCode.MysqlError, err
	}
	ok := rowsAffected >= 1
	Logger.Debug("AddPlayerWallet", zap.Int64("rowsAffected", rowsAffected),
		zap.Bool("add", ok))
	if !ok {
		return Constants.RetCode.UnknownError, nil
	}
	return 0, nil
}
