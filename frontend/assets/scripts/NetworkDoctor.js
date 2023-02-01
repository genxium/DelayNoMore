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
  this.rollbackFramesThreshold = 8; // Roughly the minimum "TurnAroundFramesToRecover".
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

NetworkDoctor.prototype.isTooFast = function(mapIns) {
  const [sendingFps, srvDownsyncFps, peerUpsyncFps, rollbackFrames, skippedRenderFrameCnt] = this.stats();
  if (sendingFps >= this.inputRateThreshold + 3) {
    // Don't send too fast
    console.log(`Sending too fast, sendingFps=${sendingFps}`);
    return true;
  } else {
    const sendingFpsNormal = (sendingFps >= this.inputRateThreshold);
    // An outstanding lag within the "inputFrameDownsyncQ" will reduce "srvDownsyncFps", HOWEVER, a constant lag wouldn't impact "srvDownsyncFps"! In native platforms we might use PING value might help as a supplement information to confirm that the "selfPlayer" is not lagged within the time accounted by "inputFrameDownsyncQ".  
    const recvFpsNormal = (srvDownsyncFps >= this.inputRateThreshold || peerUpsyncFps >= this.inputRateThreshold * (window.boundRoomCapacity - 1));
    if (sendingFpsNormal && recvFpsNormal) {
      let selfInputFrameIdFront = gopkgs.ConvertToNoDelayInputFrameId(mapIns.renderFrameId);
      let minInputFrameIdFront = Number.MAX_VALUE;
      for (let k = 0; k < window.boundRoomCapacity; ++k) {
        if (k + 1 == mapIns.selfPlayerInfo.JoinIndex) continue;
        if (mapIns.lastIndividuallyConfirmedInputFrameId[k] >= minInputFrameIdFront) continue;
        minInputFrameIdFront = mapIns.lastIndividuallyConfirmedInputFrameId[k];
      }
      if ((selfInputFrameIdFront > minInputFrameIdFront) && ((selfInputFrameIdFront - minInputFrameIdFront) > (mapIns.inputFrameUpsyncDelayTolerance+2))) {
        // first comparison condition is to avoid numeric overflow
        console.log(`Game logic ticking too fast, selfInputFrameIdFront=${selfInputFrameIdFront}, minInputFrameIdFront=${minInputFrameIdFront}, inputFrameUpsyncDelayTolerance=${mapIns.inputFrameUpsyncDelayTolerance}`);
        return true;
      }
    }
  }
  return false;
};

module.exports = NetworkDoctor;
