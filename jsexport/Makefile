PROJECTNAME=jsexport
ROOT_DIR=.
all: help
## Available proxies for downloading go modules are listed in "https://github.com/golang/go/wiki/Modules#how-do-i-use-vendoring-with-modules-is-vendoring-going-away". 
#GOPROXY=https://mirrors.aliyun.com/goproxy 
GOPROXY=https://goproxy.io

serve:
	gopherjs serve $(PROJECTNAME)

clean: 
	gopherjs clean
	rm -f ../frontend/assets/plugin_scripts/jsexport.js
	rm -f ../frontend/assets/plugin_scripts/jsexport.js.map

build: clean
	gopherjs build $(PROJECTNAME)
	mv ./jsexport.js ../frontend/assets/plugin_scripts/	
	mv ./jsexport.js.map ../frontend/assets/plugin_scripts/

build-min: clean
	gopherjs build -m $(PROJECTNAME)
	mv ./jsexport.js ../frontend/assets/plugin_scripts/	
	mv ./jsexport.js.map ../frontend/assets/plugin_scripts/

.PHONY: help

help: Makefile
	@echo
	@echo " Choose a command run:"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo
 
