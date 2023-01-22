const RingBuffer = require('./RingBuffer');

var NetworkDoctor = function(capacity) {
  this.reset(capacity);
};

NetworkDoctor.prototype.reset = function(capacity) {
  this.sendingQ = new RingBuffer(capacity);
  this.inputFrameDownsyncQ = new RingBuffer(capacity);
  this.peerInputFrameUpsyncQ = new RingBuffer(capacity);
  this.peerInputFrameUpsyncCnt = 0;
  this.immediateRollbackFrames = 0;
  this.skippedRenderFrameCnt = 0;

  this.inputRateThreshold = gopkgs.ConvertToNoDelayInputFrameId(60);
  this.peerUpsyncThreshold = 8;
  this.rollbackFramesThreshold = 4; // Slightly smaller than the minimum "TurnAroundFramesToRecover".
};

NetworkDoctor.prototype.logSending = function(stFrameId, edFrameId) {
  this.sendingQ.put({
    i: stFrameId,
    j: edFrameId,
    t: Date.now()
  });
};

NetworkDoctor.prototype.logInputFrameDownsync = function(stFrameId, edFrameId) {
  this.inputFrameDownsyncQ.put({
    i: stFrameId,
    j: edFrameId,
    t: Date.now()
  });
};

NetworkDoctor.prototype.logPeerInputFrameUpsync = function(stFrameId, edFrameId) {
  const firstPopped = this.peerInputFrameUpsyncQ.put({
    i: stFrameId,
    j: edFrameId,
    t: Date.now()
  });
  if (null != firstPopped) {
    this.peerInputFrameUpsyncCnt -= (firstPopped.j - firstPopped.i + 1);
  }
  this.peerInputFrameUpsyncCnt += (edFrameId - stFrameId + 1);
};

NetworkDoctor.prototype.logRollbackFrames = function(x) {
  this.immediateRollbackFrames = x;
};

NetworkDoctor.prototype.stats = function() {
  let sendingFps = 0,
    srvDownsyncFps = 0,
    peerUpsyncFps = 0,
    rollbackFrames = this.immediateRollbackFrames;
  if (1 < this.sendingQ.cnt) {
    const st = this.sendingQ.getByFrameId(this.sendingQ.stFrameId);
    const ed = this.sendingQ.getByFrameId(this.sendingQ.edFrameId - 1);
    const elapsedMillis = ed.t - st.t;
    sendingFps = Math.round((ed.j - st.i) * 1000 / elapsedMillis);
  }
  if (1 < this.inputFrameDownsyncQ.cnt) {
    const st = this.inputFrameDownsyncQ.getByFrameId(this.inputFrameDownsyncQ.stFrameId);
    const ed = this.inputFrameDownsyncQ.getByFrameId(this.inputFrameDownsyncQ.edFrameId - 1);
    const elapsedMillis = ed.t - st.t;
    srvDownsyncFps = Math.round((ed.j - st.i) * 1000 / elapsedMillis);
  }
  if (1 < this.peerInputFrameUpsyncQ.cnt) {
    const st = this.peerInputFrameUpsyncQ.getByFrameId(this.peerInputFrameUpsyncQ.stFrameId);
    const ed = this.peerInputFrameUpsyncQ.getByFrameId(this.peerInputFrameUpsyncQ.edFrameId - 1);
    const elapsedMillis = ed.t - st.t;
    peerUpsyncFps = Math.round(this.peerInputFrameUpsyncCnt * 1000 / elapsedMillis);
  }
  return [sendingFps, srvDownsyncFps, peerUpsyncFps, rollbackFrames, this.skippedRenderFrameCnt];
};

NetworkDoctor.prototype.logSkippedRenderFrameCnt = function() {
  this.skippedRenderFrameCnt += 1;
}

NetworkDoctor.prototype.isTooFast = function() {
  const [sendingFps, srvDownsyncFps, peerUpsyncFps, rollbackFrames, skippedRenderFrameCnt] = this.stats();
  if (sendingFps >= this.inputRateThreshold + 2) {
    // Don't send too fast
    return true;
  } else if (sendingFps >= this.inputRateThreshold && srvDownsyncFps >= this.inputRateThreshold) {
    // At least my network is OK for both TX & RX directions -- PING value might help as a supplement information here to confirm that the "selfPlayer" is not lagged in RX which results in the "rollbackFrames", but not necessary -- a significant lag within the "inputFrameDownsyncQ" will reduce "srvDownsyncFps". 
    if (rollbackFrames >= this.rollbackFramesThreshold) {
      // I got many frames rolled back while none of my peers effectively helped my preciction. Deliberately not using "peerUpsyncThreshold" here because when using UDP p2p upsync broadcasting, we expect to receive effective p2p upsyncs from every other player.   
      return true;
    }
  }
  return false;
};

module.exports = NetworkDoctor;
