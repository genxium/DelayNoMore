package main

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	. "server/common"
	"server/models"
)

var relativePath string

func loadTMX(fp string, pTmxMapIns *models.TmxMap) {
	if !filepath.IsAbs(fp) {
		panic("Tmx filepath must be absolute!")
	}

	byteArr, err := ioutil.ReadFile(fp)
	if nil != err {
		panic(err)
	}
	models.DeserializeToTmxMapIns(byteArr, pTmxMapIns)
	for _, info := range pTmxMapIns.TreasuresInfo {
		fmt.Printf("treasuresInfo: %v\n", info)
	}
	for _, info := range pTmxMapIns.HighTreasuresInfo {
		fmt.Printf("treasuresInfo: %v\n", info)
	}
}

func loadTSX(fp string, pTsxIns *models.Tsx) {
	if !filepath.IsAbs(fp) {
		panic("Tmx filepath must be absolute!")
	}

	byteArr, err := ioutil.ReadFile(fp)
	if nil != err {
		panic(err)
	}
	models.DeserializeToTsxIns(byteArr, pTsxIns)
	for _, Pos := range pTsxIns.TrapPolyLineList {
		fmt.Printf("%v\n", Pos)
	}
}

func getTMXInfo() {
	relativePath = "../frontend/assets/resources/map/treasurehunter.tmx"
	execPath, err := os.Executable()
	if nil != err {
		panic(err)
	}

	pwd, err := os.Getwd()
	if nil != err {
		panic(err)
	}

	fmt.Printf("execPath = %v, pwd = %s, returning...\n", execPath, pwd)

	tmxMapIns := models.TmxMap{}
	pTmxMapIns := &tmxMapIns
	fp := filepath.Join(pwd, relativePath)
	fmt.Printf("fp == %v\n", fp)
	loadTMX(fp, pTmxMapIns)
}

func getTSXInfo() {

	relativePath = "../frontend/assets/resources/map/tile_1.tsx"
	execPath, err := os.Executable()
	if nil != err {
		panic(err)
	}

	pwd, err := os.Getwd()
	if nil != err {
		panic(err)
	}

	fmt.Printf("execPath = %v, pwd = %s, returning...\n", execPath, pwd)
	tsxIns := models.Tsx{}
	pTsxIns := &tsxIns
	fp := filepath.Join(pwd, relativePath)
	fmt.Printf("fp == %v\n", fp)
	loadTSX(fp, pTsxIns)
}

func main() {
	getTSXInfo()
}
