module server

go 1.19

require (
	github.com/Masterminds/squirrel v0.0.0-20180815162352-8a7e65843414
	github.com/davecgh/go-spew v1.1.1
	github.com/gin-contrib/cors v0.0.0-20180514151808-6f0a820f94be
	github.com/gin-gonic/gin v1.3.0
	github.com/go-redis/redis v6.13.2+incompatible
	github.com/go-sql-driver/mysql v1.4.0
	github.com/golang/protobuf v1.5.2
	github.com/gorilla/websocket v1.2.0
	github.com/hashicorp/go-cleanhttp v0.0.0-20171218145408-d5fe4b57a186
	github.com/imdario/mergo v0.3.6
	github.com/jmoiron/sqlx v0.0.0-20180614180643-0dae4fefe7c0
	github.com/logrusorgru/aurora v0.0.0-20181002194514-a7b3b318ed4e
	github.com/robfig/cron v0.0.0-20180505203441-b41be1df6967
	github.com/solarlune/resolv v0.5.1
	github.com/thoas/go-funk v0.0.0-20180716193722-1060394a7713
	go.uber.org/zap v1.9.1
	google.golang.org/protobuf v1.28.1

    dnmshared v0.0.0
)

require (
	github.com/ChimeraCoder/gojson v1.0.0 // indirect
	github.com/fatih/color v1.7.0 // indirect
	github.com/gin-contrib/sse v0.0.0-20170109093832-22d885f9ecc7 // indirect
	github.com/githubnemo/CompileDaemon v1.0.0 // indirect
	github.com/google/go-cmp v0.5.9 // indirect
	github.com/howeyc/fsnotify v0.9.0 // indirect
	github.com/kvartborg/vector v0.0.0-20200419093813-2cba0cabb4f0 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	github.com/mattn/go-isatty v0.0.16 // indirect
	github.com/mattn/go-sqlite3 v1.14.15 // indirect
	github.com/ugorji/go v1.1.1 // indirect
	go.uber.org/atomic v1.3.2 // indirect
	go.uber.org/multierr v1.1.0 // indirect
	golang.org/x/sys v0.0.0-20220811171246-fbc7d0a398ab // indirect
	golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543 // indirect
	gopkg.in/check.v1 v0.0.0-20161208181325-20d25e280405 // indirect
	gopkg.in/go-playground/validator.v8 v8.18.2 // indirect
	gopkg.in/yaml.v2 v2.2.1 // indirect
)

replace (
	dnmshared => ../dnmshared
)
