package models

import (
	"time"
)

type Watchdog struct {
	interval time.Duration
	timer    *time.Timer
}

func NewWatchdog(interval time.Duration, callback func()) *Watchdog {
	w := Watchdog{
		interval: interval,
		timer:    time.AfterFunc(interval, callback),
	}
	return &w
}

func (w *Watchdog) Stop() {
	w.timer.Stop()
}

func (w *Watchdog) Kick() {
	w.timer.Stop()
	w.timer.Reset(w.interval)
}
