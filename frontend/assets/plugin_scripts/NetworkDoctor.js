function NetworkDoctor(serverFps, clientUpsyncFps) {
  this.serverFps = serverFps;
  this.clientUpsyncFps = clientUpsyncFps;
  this.millisPerServerFrame = parseInt(1000 / this.serverFps);
  this._tooLongSinceLastFrameDiffReceivedThreshold = (this.millisPerServerFrame << 6);

  this.setupFps = function(fps) {
    this.serverFps = this.clientUpsyncFps = fps;
    this.millisPerServerFrame = parseInt(1000 / this.serverFps);
    this._tooLongSinceLastFrameDiffReceivedThreshold = (this.millisPerServerFrame << 6);
  }

  this._lastFrameDiffRecvTime = null;
  this._tooLongSinceLastFrameDiffReceived = function() {
    if (undefined === this._lastFrameDiffRecvTime || null === this._lastFrameDiffRecvTime) return false;
    return (this._tooLongSinceLastFrameDiffReceivedThreshold <= (Date.now() - this._lastFrameDiffRecvTime));
  };

  this._consecutiveALittleLongFrameDiffReceivedIntervalCount = 0;
  this._consecutiveALittleLongFrameDiffReceivedIntervalCountThreshold = 120;

  this.onNewFrameDiffReceived = function(frameDiff) {
    var now = Date.now();
    if (undefined !== this._lastFrameDiffRecvTime && null !== this._lastFrameDiffRecvTime) {
      var intervalFromLastFrameDiff = (now - this._lastFrameDiffRecvTime);
      if ((this.millisPerServerFrame << 5) < intervalFromLastFrameDiff) {
        ++this._consecutiveALittleLongFrameDiffReceivedIntervalCount;
        console.log('Medium delay, intervalFromLastFrameDiff is', intervalFromLastFrameDiff);
      } else {
        this._consecutiveALittleLongFrameDiffReceivedIntervalCount = 0;
      }
    }
    this._lastFrameDiffRecvTime = now;
  };

  this._networkComplaintPrefix = "\nNetwork is not good >_<\n";

  this.generateNetworkComplaint = function(excludeTypeConstantALittleLongFrameDiffReceivedInterval, excludeTypeTooLongSinceLastFrameDiffReceived) {
    if (this.hasBattleStopped) return null;
    var shouldComplain = false;
    var ret = this._networkComplaintPrefix;
    if (true != excludeTypeConstantALittleLongFrameDiffReceivedInterval && this._consecutiveALittleLongFrameDiffReceivedIntervalCountThreshold <= this._consecutiveALittleLongFrameDiffReceivedIntervalCount) {
      this._consecutiveALittleLongFrameDiffReceivedIntervalCount = 0;
      ret += "\nConstantly having a little long recv interval.\n";
      shouldComplain = true;
    }
    if (true != excludeTypeTooLongSinceLastFrameDiffReceived && this._tooLongSinceLastFrameDiffReceived()) {
      ret += "\nToo long since last received frameDiff.\n";
      shouldComplain = true;
    }
    return (shouldComplain ? ret : null);
  };

  this.hasBattleStopped = false;
  this.onBattleStopped = function() {
    this.hasBattleStopped = true;
  };

  this.isClientSessionConnected = function() {
    if (!window.game) return false;
    if (!window.game.clientSession) return false;
    return window.game.clientSession.connected; 
  };
}

window.NetworkDoctor = NetworkDoctor;
