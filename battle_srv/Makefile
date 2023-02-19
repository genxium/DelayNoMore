PROJECTNAME=server.exe
ROOT_DIR=.
#GOPROXY=https://mirrors.aliyun.com/goproxy 
GOPROXY=https://goproxy.io
all: help

# To install `gojson` executable
# ```
# go install github.com/ChimeraCoder/gojson/gojson@latest
# ```
# 
# OS detection reference https://stackoverflow.com/a/12099167
gen-constants:
	gojson -pkg common -name constants -input common/constants.json  -o common/constants_struct.go
ifeq ($(OS),Windows_NT)
	sed -i 's/int64/int/g' common/constants_struct.go
else
	UNAME_S := $(shell uname -s)
	ifeq ($(UNAME_S),Darwin)
		sed -i '' -e 's/int64/int/g' common/constants_struct.go
	else
		sed -i 's/int64/int/g' common/constants_struct.go
	endif
endif

run-test: build
	ServerEnv=TEST ./$(PROJECTNAME)

run-test-and-hotreload:
	ServerEnv=TEST CompileDaemon -log-prefix=false -build="go build"  -command="./$(PROJECTNAME)"

build:
	GOPROXY=$(GOPROXY) go build -o $(ROOT_DIR)/$(PROJECTNAME)

run-prod: build-prod
	./$(PROJECTNAME)

build-prod:
	GOPROXY=$(GOPROXY) go build -ldflags "-s -w -X main.VERSION=$(shell git rev-parse --short HEAD)-$(shell date "+%Y%m%d-%H:%M:%S")" -o $(ROOT_DIR)/$(PROJECTNAME)

.PHONY: help

help: Makefile
	@echo
	@echo " Choose a command run:"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo
 
