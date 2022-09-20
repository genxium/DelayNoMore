(function () {
    if (!(cc && cc.Audio)) {
        return;
    }
    cc.Audio.prototype.stop = function () {
        if (!this._element) return;
        this._element.stop();
        this._element.currentTime = 0;
        this._unbindEnded();
        this.emit('stop');
        this._state = cc.Audio.State.STOPPED;
    };
})();