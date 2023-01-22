PROJECTNAME=jsexport
ROOT_DIR=.
all: help
## Available proxies for downloading go modules are listed in "https://github.com/golang/go/wiki/Modules#how-do-i-use-vendoring-with-modules-is-vendoring-going-away". 
#GOPROXY=https://mirrors.aliyun.com/goproxy 
GOPROXY=https://goproxy.io
DST=../frontend/assets/scripts/modules

serve:
	gopherjs serve $(PROJECTNAME)

clean: 
	gopherjs clean
	rm -f $(DST)/jsexport.js
	#rm -f $(DST)/jsexport.js.map

build: clean
	gopherjs build $(PROJECTNAME)
	mv ./jsexport.js $(DST)/	
	#mv ./jsexport.js.map $(DST)/

build-min: clean
	gopherjs build -m $(PROJECTNAME)
	mv ./jsexport.js $(DST)/	
	#mv ./jsexport.js.map $(DST)/

.PHONY: help

help: Makefile
	@echo
	@echo " Choose a command run:"
	@echo
	@sed -n 's/^##//p' $< | column -t -s ':' |  sed -e 's/^/ /'
	@echo
 
