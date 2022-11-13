package storage

import (
	. "battle_srv/common"

	_ "github.com/go-sql-driver/mysql"
	"github.com/jmoiron/sqlx"
	"go.uber.org/zap"

	. "dnmshared"
)

var (
	MySQLManagerIns *sqlx.DB
)

func initMySQL() {
	var err error
	MySQLManagerIns, err = sqlx.Connect("mysql", Conf.MySQL.DSN+"?charset=utf8mb4")
	if nil != err {
		panic(err)
	}
	err = MySQLManagerIns.Ping()
	if nil != err {
		panic(err)
	}
	Logger.Info("MySQLManagerIns", zap.Any("mysql", MySQLManagerIns))
}
