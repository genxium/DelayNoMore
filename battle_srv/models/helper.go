package models

import (
	"database/sql"
	. "server/common"
	"server/storage"

	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"
)

func exist(t string, cond sq.Eq) (bool, error) {
	c, err := getCount(t, cond)
	if err != nil {
		return false, err
	}
	return c >= 1, nil
}

func getCount(t string, cond sq.Eq) (int, error) {
	query, args, err := sq.Select("count(1)").From(t).Where(cond).ToSql()
	if err != nil {
		return 0, err
	}
	//Logger.Debug("getCount", zap.String("sql", query), zap.Any("args", args))
	var c int
	err = storage.MySQLManagerIns.Get(&c, query, args...)
	return c, err
}

func insert(t string, cols []string, vs []interface{}) (sql.Result, error) {
	query, args, err := sq.Insert(t).Columns(cols...).Values(vs...).ToSql()
	Logger.Debug("txInsert", zap.String("sql", query))
	if err != nil {
		return nil, err
	}
	result, err := storage.MySQLManagerIns.Exec(query, args...)
	return result, err
}

func txInsert(tx *sqlx.Tx, t string, cols []string, vs []interface{}) (sql.Result, error) {
	query, args, err := sq.Insert(t).Columns(cols...).Values(vs...).ToSql()
	//Logger.Debug("txInsert", zap.String("sql", query))
	if err != nil {
		return nil, err
	}
	result, err := tx.Exec(query, args...)
	return result, err
}

func getFields(t string, fields []string, cond sq.Eq, dest interface{}) error {
	query, args, err := sq.Select(fields...).From(t).Where(cond).Limit(1).ToSql()
	Logger.Debug("getFields", zap.String("sql", query), zap.Any("args", args))
	if err != nil {
		return err
	}
	err = storage.MySQLManagerIns.Get(dest, query, args...)
	return err
}

func getObj(t string, cond sq.Eq, dest interface{}) error {
	query, args, err := sq.Select("*").From(t).Where(cond).Limit(1).ToSql()
	Logger.Debug("getObj", zap.String("sql", query), zap.Any("args", args))
	if err != nil {
		return err
	}
	err = storage.MySQLManagerIns.Get(dest, query, args...)
	return err
}

func getList(t string, cond sq.Eq, dest interface{}) error {
	query, args, err := sq.Select("*").From(t).Where(cond).ToSql()
	Logger.Debug("getList", zap.String("sql", query), zap.Any("args", args))
	if err != nil {
		return err
	}
	err = storage.MySQLManagerIns.Select(dest, query, args...)
	//Logger.Debug("getList", zap.Error(err))
	return err
}
