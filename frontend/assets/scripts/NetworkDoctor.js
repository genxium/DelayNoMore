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

NetworkDoctor.prototype.statSending = function() {
  if (1 >= this.sendingQ.cnt) return `0 fps sending`;
  const st = this.sendingQ.getByFrameId(this.sendingQ.stFrameId);
  const ed = this.sendingQ.getByFrameId(this.sendingQ.edFrameId - 1);
  const elapsedMillis = ed.t - st.t;
  const fps = Math.round((ed.j - st.i) * 1000 / elapsedMillis);
  return `${fps} fps sending`;
};

NetworkDoctor.prototype.statInputFrameDownsync = function() {
  if (1 >= this.inputFrameDownsyncQ.cnt) return `0 fps srv downsync`;
  const st = this.inputFrameDownsyncQ.getByFrameId(this.inputFrameDownsyncQ.stFrameId);
  const ed = this.inputFrameDownsyncQ.getByFrameId(this.inputFrameDownsyncQ.edFrameId - 1);
  const elapsedMillis = ed.t - st.t;
  const fps = Math.round((ed.j - st.i) * 1000 / elapsedMillis);
  return `${fps} fps srv downsync`;
};

NetworkDoctor.prototype.statPeerInputFrameUpsync = function() {
  if (1 >= this.peerInputFrameUpsyncQ.cnt) return `0 fps peer upsync`;
  const st = this.peerInputFrameUpsyncQ.getByFrameId(this.peerInputFrameUpsyncQ.stFrameId);
  const ed = this.peerInputFrameUpsyncQ.getByFrameId(this.peerInputFrameUpsyncQ.edFrameId - 1);
  const elapsedMillis = ed.t - st.t;
  const fps = Math.round(this.peerInputFrameUpsyncCnt * 1000 / elapsedMillis);
  return `${fps} fps peer upsync`;
};

NetworkDoctor.prototype.statRollbackFrames = function() {
  return `${this.immediateRollbackFrames} rollback frames`;
};

module.exports = NetworkDoctor;
