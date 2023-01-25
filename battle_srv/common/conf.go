package common

import (
	. "dnmshared"
	"encoding/json"
	"fmt"
	"go.uber.org/zap"
	"os"
	"path/filepath"
	"strings"
)

var Conf *config

const (
	APP_NAME        = "server"
	SERVER_ENV_PROD = "PROD"
	SERVER_ENV_TEST = "TEST"
)

type generalConf struct {
	AppRoot           string `json:"-"`
	ConfDir           string `json:"-"`
	TestEnvSQLitePath string `json:"-"`
	PreConfSQLitePath string `json:"-"`
	ServerEnv         string `json:"-"`
}

type mysqlConf struct {
	DSN      string `json:"-"`
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Dbname   string `json:"dbname"`
	Username string `json:"username"`
	Password string `json:"password"`
}

type sioConf struct {
	HostAndPort string `json:"hostAndPort"`
	UdpHost     string `json:"udpHost"`
	UdpPort     int    `json:"udpPort"`
}

type botServerConf struct {
	SecondsBeforeSummoning int    `json:"secondsBeforeSummoning"`
	Protocol               string `json:"protocol"`
	Host                   string `json:"host"`
	Port                   int    `json:"port"`
	SymmetricKey           string `json:"symmetricKey"`
}

type redisConf struct {
	Dbname   int    `json:"dbname"`
	Host     string `json:"host"`
	Password string `json:"password"`
	Port     int    `json:"port"`
}

type config struct {
	General   *generalConf
	MySQL     *mysqlConf
	Sio       *sioConf
	Redis     *redisConf
	BotServer *botServerConf
}

func MustParseConfig() {
	Conf = &config{
		General:   new(generalConf),
		MySQL:     new(mysqlConf),
		Sio:       new(sioConf),
		Redis:     new(redisConf),
		BotServer: new(botServerConf),
	}
	execPath, err := os.Executable()
	if nil != err {
		panic(err)
	}

	pwd, err := os.Getwd()
	Logger.Debug("os.GetWd", zap.String("pwd", pwd))
	if nil != err {
		panic(err)
	}

	appRoot := pwd
	confDir := filepath.Join(appRoot, "configs")
	Logger.Debug("conf", zap.String("dir", confDir))
	if isNotExist(confDir) {
		appRoot = filepath.Dir(execPath)
		confDir = filepath.Join(appRoot, "configs")
		Logger.Debug("conf", zap.String("dir", confDir))
		if isNotExist(confDir) {
			i := strings.LastIndex(pwd, "battle_srv")
			if i == -1 {
				Logger.Fatal("无法找到配置目录，cp -rn configs.template configs，并配置相关参数，再启动")
			}
			appRoot = pwd[:(i + 10)]
			confDir = filepath.Join(appRoot, "configs")
			Logger.Debug("conf", zap.String("dir", confDir))
			if isNotExist(confDir) {
				Logger.Fatal("无法找到配置目录，cp -rn configs.template configs，并配置相关参数，再启动")
			}
		}
	}
	Conf.General.AppRoot = appRoot
	testEnvSQLitePath := filepath.Join(confDir, "test_env.sqlite")
	if !isNotExist(testEnvSQLitePath) {
		Conf.General.TestEnvSQLitePath = testEnvSQLitePath
	}
	preConfSQLitePath := filepath.Join(confDir, "pre_conf_data.sqlite")
	if !isNotExist(preConfSQLitePath) {
		Conf.General.PreConfSQLitePath = preConfSQLitePath
	}
	Conf.General.ConfDir = confDir
	Conf.General.ServerEnv = os.Getenv("ServerEnv")

	loadJSON("mysql.json", Conf.MySQL)
	setMySQLDSNURL(Conf.MySQL)
	loadJSON("sio.json", Conf.Sio)
	loadJSON("redis.json", Conf.Redis)
	loadJSON("bot_server.json", Conf.BotServer)
}

func setMySQLDSNURL(c *mysqlConf) {
	var dsn = fmt.Sprintf("%s:%s@tcp(%s:%d)/%s",
		c.Username, c.Password, c.Host, c.Port, c.Dbname)
	c.DSN = dsn

}

func loadJSON(fp string, v interface{}) {
	if !filepath.IsAbs(fp) {
		fp = filepath.Join(Conf.General.ConfDir, fp)
	}
	_, err := os.Stat(fp)
	if nil != err {
		panic(err)
	}

	fd, err := os.Open(fp)
	if nil != err {
		panic(err)
	}
	defer fd.Close()
	Logger.Info("Opened json file successfully.", zap.String("fp", fp))
	err = json.NewDecoder(fd).Decode(v)
	if nil != err {
		panic(err)
	}
	Logger.Info("Loaded json file successfully.", zap.String("fp", fp))
}

func isNotExist(p string) bool {
	if _, err := os.Stat(p); err != nil {
		return true
	}
	return false
}
