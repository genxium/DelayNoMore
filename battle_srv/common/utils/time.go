package utils

import "time"

func UnixtimeNano() int64 {
	return time.Now().UnixNano()
}

func UnixtimeMicro() int64 {
	return time.Now().UnixNano() / 1000
}

func UnixtimeMilli() int64 {
	return time.Now().UnixNano() / 1000000
}

func UnixtimeSec() int64 {
	return time.Now().Unix()
}
