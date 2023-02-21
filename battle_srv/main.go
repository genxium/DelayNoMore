package main

import (
	"battle_srv/api"
	"battle_srv/api/v1"
	. "battle_srv/common"
	"battle_srv/env_tools"
	"battle_srv/models"
	"battle_srv/storage"
	"battle_srv/ws"
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	. "dnmshared"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/robfig/cron"
	"go.uber.org/zap"

	"net"
	// _ "net/http/pprof"
)

func main() {
	/*
		        // Only used for profiling
			go func() {
				http.ListenAndServe("0.0.0.0:6060", nil)
			}()
	*/
	MustParseConfig()
	MustParseConstants()
	storage.Init()
	env_tools.LoadPreConf()
	if Conf.General.ServerEnv == SERVER_ENV_TEST {
		env_tools.MergeTestPlayerAccounts()
	}
	models.InitRoomHeapManager()
	// startScheduler()
	router := gin.Default()
	setRouter(router)

	srv := &http.Server{
		Addr:    fmt.Sprintf("%s", Conf.Sio.HostAndPort),
		Handler: router,
	}
	/*
	 * To disable "Keep-Alive" of http/1.0 clients, thus avoid confusing results when inspecting leaks by `netstat`.
	 *
	 * -- YFLu
	 */
	srv.SetKeepAlivesEnabled(false)
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			Logger.Fatal("Error launching the service:", zap.Error(err))
		}
		Logger.Info("Listening and serving HTTP on", zap.Any("Conf.Sio.HostAndPort", Conf.Sio.HostAndPort))
	}()
	go startGrandUdpServer()
	var gracefulStop = make(chan os.Signal)
	signal.Notify(gracefulStop, syscall.SIGTERM)
	signal.Notify(gracefulStop, syscall.SIGINT)
	sig := <-gracefulStop
	Logger.Info("Shutdown Server ...")
	Logger.Info("caught sig", zap.Any("sig", sig))
	Logger.Info("Wait for 5 second to finish processing")
	clean()
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		Logger.Fatal("Server Shutdown:", zap.Error(err))
	}
	Logger.Info("Server exiting")
	os.Exit(0)
}

func clean() {
	Logger.Info("About to clean up the resources occupied by this server-process.")
	if storage.MySQLManagerIns != nil {
		storage.MySQLManagerIns.Close()
	}
	if Logger != nil {
		Logger.Sync()
	}
}

func setRouter(router *gin.Engine) {
	f := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ping": "pong"})
	}
	router.Use(cors.Default())
	router.StaticFS("/asset", http.Dir(filepath.Join(Conf.General.AppRoot, "asset")))
	router.GET("/ping", f)
	router.GET("/tsrht", ws.Serve)
	router.GET("/tsrhtSecondary", ws.HandleSecondaryWsSessionForPlayer)

	apiRouter := router.Group("/api")
	{
		apiRouter.Use(api.HandleRet(), api.RequestLogger())
		apiRouter.POST("/player/v1/IntAuthToken/login", v1.Player.IntAuthTokenLogin)
		apiRouter.POST("/player/v1/IntAuthToken/logout", v1.Player.IntAuthTokenLogout)
		apiRouter.GET("/player/v1/SmsCaptcha/get", v1.Player.SMSCaptchaGet)
		apiRouter.POST("/player/v1/SmsCaptcha/login", v1.Player.SMSCaptchaLogin)
		apiRouter.POST("/player/v1/wechat/login", v1.Player.WechatLogin)
		apiRouter.POST("/player/v1/wechat/jsconfig", v1.Player.GetWechatShareConfig)
		apiRouter.POST("/player/v1/wechatGame/login", v1.Player.WechatGameLogin)

		authRouter := func(method string, url string, handler gin.HandlerFunc) {
			apiRouter.Handle(method, url, v1.Player.TokenAuth, handler)
		}
		authRouter(http.MethodPost, "/player/v1/profile/fetch", v1.Player.FetchProfile)
	}
}

func startScheduler() {
	c := cron.New()
	//c.AddFunc("*/1 * * * * *", FuncName)
	c.Start()
}

func startGrandUdpServer() {
	conn, err := net.ListenUDP("udp", &net.UDPAddr{
		Port: Conf.Sio.UdpPort,
		IP:   net.ParseIP(Conf.Sio.UdpHost),
	})
	if err != nil {
		panic(err)
	}

	defer func() {
		conn.Close()
		if r := recover(); r != nil {
			Logger.Error("`GrandUdpServer`, recovery spot#1, recovered from: ", zap.Any("panic", r))
		}
		Logger.Info(fmt.Sprintf("The `GrandUdpServer` is stopped"))
	}()

	Logger.Info(fmt.Sprintf("`GrandUdpServer` started at %s", conn.LocalAddr().String()))

	for {
		message := make([]byte, 2046)
		rlen, remote, err := conn.ReadFromUDP(message[:])
		if err != nil {
			panic(err)
		}
		Logger.Info(fmt.Sprintf("`GrandUdpServer` received: %d bytes from %s\n", rlen, remote))
		ws.HandleUdpHolePunchingForPlayer(message[0:rlen], remote)
	}
}
