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

RingBuffer.prototype.getByOffset = function(offsetFromSt) {
  if (0 == this.cnt) {
    return null;
  }
  let arrIdx = this.st + offsetFromSt;
  if (this.st < this.ed) {
    // case#1: 0...st...ed...n-1
    if (this.st <= arrIdx && arrIdx < this.ed) {
      return this.eles[arrIdx];
    }
  } else {
    // if this.st >= this.sd
    // case#2: 0...ed...st...n-1
    if (arrIdx >= this.n) {
      arrIdx -= this.n
    }
    if (arrIdx >= this.st || arrIdx < this.ed) {
      return this.eles[arrIdx];
    }
  }

  return null;
};

RingBuffer.prototype.getByFrameId = function(frameId) {
  return this.getByOffset(frameId - this.stFrameId);
};

module.exports = RingBuffer;
