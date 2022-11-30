window.RING_BUFF_CONSECUTIVE_SET = 0;
window.RING_BUFF_NON_CONSECUTIVE_SET = 1;
window.RING_BUFF_FAILED_TO_SET = 2;

var RingBuffer = function(capacity) {
  this.ed = 0; // write index, open index
  this.st = 0; // read index, closed index
  this.edFrameId = 0;
  this.stFrameId = 0;
  this.n = capacity;
  this.cnt = 0; // the count of valid elements in the buffer, used mainly to distinguish what "st == ed" means for "Pop" and "Get" methods
  this.eles = new Array(capacity).fill(null);
};

RingBuffer.prototype.put = function(item) {
  while (this.cnt >= this.n - 1) {
    // Make room for the new element
    this.pop();
  }
  this.eles[this.ed] = item
  this.edFrameId++;
  this.cnt++;
  this.ed++;
  if (this.ed >= this.n) {
    this.ed -= this.n; // Deliberately not using "%" operator for performance concern
  }
};

RingBuffer.prototype.pop = function() {
  if (0 == this.cnt) {
    return null;
  }
  const item = this.eles[this.st];
  this.stFrameId++;
  this.cnt--;
  this.st++;
  if (this.st >= this.n) {
    this.st -= this.n;
  }
  return item;
};

RingBuffer.prototype.getArrIdxByOffset = function(offsetFromSt) {
  if (0 > offsetFromSt || 0 == this.cnt) {
    return null;
  }
  let arrIdx = this.st + offsetFromSt;
  if (this.st < this.ed) {
    // case#1: 0...st...ed...n-1
    if (this.st <= arrIdx && arrIdx < this.ed) {
      return arrIdx;
    }
  } else {
    // if this.st >= this.sd
    // case#2: 0...ed...st...n-1
    if (arrIdx >= this.n) {
      arrIdx -= this.n
    }
    if (arrIdx >= this.st || arrIdx < this.ed) {
      return arrIdx;
    }
  }

  return null;
};

RingBuffer.prototype.getByFrameId = function(frameId) {
  if (frameId >= this.edFrameId) return null;
  const arrIdx = this.getArrIdxByOffset(frameId - this.stFrameId);
  return (null == arrIdx ? null : this.eles[arrIdx]);
};

// [WARNING] During a battle, frontend could receive non-consecutive frames (either renderFrame or inputFrame) due to resync, the buffer should handle these frames properly. 
RingBuffer.prototype.setByFrameId = function(item, frameId) {
  const oldStFrameId = this.stFrameId,
    oldEdFrameId = this.edFrameId;
  if (frameId < oldStFrameId) {
    return [window.RING_BUFF_FAILED_TO_SET, oldStFrameId, oldEdFrameId];
  }
  // By now "this.stFrameId <= frameId"

  if (oldEdFrameId > frameId) {
    const arrIdx = this.getArrIdxByOffset(frameId - this.stFrameId);
    if (null != arrIdx) {
      this.eles[arrIdx] = item;
      return [window.RING_BUFF_CONSECUTIVE_SET, oldStFrameId, oldEdFrameId];
    }
  }

  // By now "this.edFrameId <= frameId"
  let ret = window.RING_BUFF_CONSECUTIVE_SET;
  if (oldEdFrameId < frameId) {
    this.st = this.ed = 0;
    this.stFrameId = this.edFrameId = frameId;
    this.cnt = 0;
    ret = window.RING_BUFF_NON_CONSECUTIVE_SET;
  }

  // By now "this.edFrameId == frameId" 
  this.put(item);

  return [ret, oldStFrameId, oldEdFrameId];
};

module.exports = RingBuffer;
