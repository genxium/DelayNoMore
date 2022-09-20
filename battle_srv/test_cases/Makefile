PROJECTNAME=tests
ROOT_DIR=$(shell pwd)
all: help

run-test: build
	GOPATH=$(GOPATH):$(ROOT_DIR)/.. ServerEnv=TEST ./$(PROJECTNAME)

build:
	go build -o $(ROOT_DIR)/$(PROJECTNAME) ./tests.go
