PROJECTNAME=jsexport
ROOT_DIR=.
all: help
## Available proxies for downloading go modules are listed in "https://github.com/golang/go/wiki/Modules#how-do-i-use-vendoring-with-modules-is-vendoring-going-away". 
#GOPROXY=https://mirrors.aliyun.com/goproxy 
GOPROXY=https://goproxy.io

serve:
	gopherjs serve $(PROJECTNAME)

build:
	gopherjs build $(PROJECTNAME)

build-min:
	gopherjs build -m $(PROJECTNAME)

.PHONY: help

help: Makefile
	@echo
	@echo " Choose a command run:"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo
 
