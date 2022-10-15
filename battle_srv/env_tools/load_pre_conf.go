package env_tools

import (
	. "dnmshared"
	sq "github.com/Masterminds/squirrel"
	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
	"go.uber.org/zap"
	. "server/common"
	"server/common/utils"
	"server/models"
	"server/storage"
)

func LoadPreConf() {
	Logger.Info(`Merging PreConfSQLite data into MySQL`,
		zap.String("PreConfSQLitePath", Conf.General.PreConfSQLitePath))
	db, err := sqlx.Connect("sqlite3", Conf.General.PreConfSQLitePath)
	if nil != err {
		panic(err)
	}
	defer db.Close()

	loadPreConfToMysql(db)

	// --kobako
	maybeCreateNewPlayerFromBotTable(db, "bot_player")
}

type dbBotPlayer struct {
	Name                  string `db:"name"`
	MagicPhoneCountryCode string `db:"magic_phone_country_code"`
	MagicPhoneNum         string `db:"magic_phone_num"`
	DisplayName           string `db:"display_name"`
}

func loadPreConfToMysql(db *sqlx.DB) {
	tbs := []string{}
	loadSqlite(db, tbs)
}

func loadSqlite(db *sqlx.DB, tbs []string) {
	for _, v := range tbs {
		result, err := storage.MySQLManagerIns.Exec("truncate " + v)
		if nil != err {
			panic(err)
		}
		Logger.Info("truncate", zap.Any("truncate "+v, result))
		query, args, err := sq.Select("*").From(v).ToSql()
		if err != nil {
			Logger.Info("loadSql ToSql error", zap.Any("err", err))
		}
		rows, err := db.Queryx(query, args...)
		if err != nil {
			Logger.Info("loadSql query error", zap.Any("err", err))
		}
		createMysqlData(rows, v)
	}
}

func createMysqlData(rows *sqlx.Rows, v string) {
	tx := storage.MySQLManagerIns.MustBegin()
	defer Logger.Info("Loaded table " + v + " from PreConfSQLite successfully.")
	switch v {
	// TODO
	}
	err := tx.Commit()
	if err != nil {
		defer tx.Rollback()
		Logger.Info(v+" load", zap.Any("tx.commit error", err))
	}
}

// 加上tableName参数, 用于pre_conf_data.sqlite里bot_player表的复用 --kobako
func maybeCreateNewPlayerFromBotTable(db *sqlx.DB, tableName string) {
	var ls []*dbBotPlayer
	err := db.Select(&ls, "SELECT name, magic_phone_country_code, magic_phone_num, display_name FROM "+tableName)
	if nil != err {
		panic(err)
	}
	names := make([]string, len(ls), len(ls))
	for i, v := range ls {
		names[i] = v.Name
	}
	sql := "SELECT name FROM `player` WHERE name in (?)"
	query, args, err := sqlx.In(sql, names)
	if nil != err {
		panic(err)
	}
	query = storage.MySQLManagerIns.Rebind(query)
	// existNames := make([]string, len(ls), len(ls))
	var existPlayers []*models.Player
	err = storage.MySQLManagerIns.Select(&existPlayers, query, args...)
	if nil != err {
		panic(err)
	}

	for _, botPlayer := range ls {
		var flag bool
		for _, v := range existPlayers {
			if botPlayer.Name == v.Name {
				// 已有数据，合并处理
				flag = true
				break
			}
		}
		if !flag {
			// 找不到，新增
			Logger.Debug("create", zap.Any(tableName, botPlayer))
			err := createNewBotPlayer(botPlayer)
			if err != nil {
				Logger.Warn("createNewPlayer from"+tableName, zap.NamedError("createNewPlayerErr", err))
			}
		}
	}
}

func createNewBotPlayer(p *dbBotPlayer) error {
	tx := storage.MySQLManagerIns.MustBegin()
	defer tx.Rollback()
	now := utils.UnixtimeMilli()
	player := models.Player{
		CreatedAt:   now,
		UpdatedAt:   now,
		Name:        p.Name,
		DisplayName: p.DisplayName,
	}
	err := player.Insert(tx)
	if err != nil {
		return err
	}
	playerAuthBinding := models.PlayerAuthBinding{
		CreatedAt: now,
		UpdatedAt: now,
		Channel:   int(Constants.AuthChannel.Sms),
		ExtAuthID: p.MagicPhoneCountryCode + p.MagicPhoneNum,
		PlayerID:  int(player.Id),
	}
	err = playerAuthBinding.Insert(tx)
	if err != nil {
		return err
	}

	wallet := models.PlayerWallet{
		CreatedAt: now,
		UpdatedAt: now,
		ID:        int(player.Id),
	}
	err = wallet.Insert(tx)
	if err != nil {
		return err
	}
	tx.Commit()
	return nil
}
