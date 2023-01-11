/**
 * Creates a binary heap.
 *
 * @constructor
 * @param {function} customCompare An optional custom node comparison
 * function.
 */
var BinaryHeap = function (customCompare) {
  /**
   * The backing data of the heap.
   * @type {Object[]}
   * @private
   */
  this.list = [];
  this.lookupKeyToIndex = {};

  if (customCompare) {
    this.compare = customCompare;
  }
};

BinaryHeap.prototype.contains = function (lookupKey) {
  return null != this.lookupKeyToIndex[lookupKey];
};

/**
 * Clears the heap's data, making it an empty heap.
 */
BinaryHeap.prototype.clear = function () {
  this.list.length = 0;
  this.lookupKeyToIndex = null;
};

/**
 * Extracts and returns the minimum node from the heap.
 *
 * @return {Node} node The heap's minimum node or undefined if the heap is
 * empty.
 */
BinaryHeap.prototype.pop = function () {
  if (0 == this.list.length) {
    return null;
  }
  if (1 == this.list.length) {
    delete this.lookupKeyToIndex[Object.keys(this.lookupKeyToIndex)[0]];
    return this.list.shift();
  }
  var min = this.list[0];
  delete this.lookupKeyToIndex[min.lookupKey];

  this.list[0] = this.list.pop();
  this.lookupKeyToIndex[this.list[0].lookupKey] = 0;

  heapify(this, 0);
  return min;
};

/**
 * Returns the minimum node from the heap.
 *
 * @return {Node} node The heap's minimum node or undefined if the heap is
 * empty.
 */
BinaryHeap.prototype.top = function () {
  return this.isEmpty() ? null : this.list[0];
};

/**
 * Inserts a new key-value pair into the heap.
 *
 * @param {Object} key The key to insert.
 * @param {Object} value The value to insert.
 * @return {Node} node The inserted node.
 */
BinaryHeap.prototype.push = function (key, value, lookupKey) {
  var i = this.list.length;
  var node = new Node(key, value, lookupKey);
  this.list.push(node);
  this.lookupKeyToIndex[lookupKey] = i;
  let u = getParent(i);
  while (null != u && this.compare(this.list[i], this.list[u]) < 0) {
    swap(this.list, i, u, this.lookupKeyToIndex);
    i = u;
    u = getParent(i);
  }
  return node;
};

BinaryHeap.prototype.update = function (lookupKey, newKey, newValue) {
  if (null == this.lookupKeyToIndex[lookupKey]) return null;
  var i = this.lookupKeyToIndex[lookupKey];

  this.list[i].key = newKey;
  this.list[i].value = newValue;

  let u = getParent(i);
  if (null != u && this.compare(this.list[i], this.list[u]) < 0) {
    while (null != u && this.compare(this.list[i], this.list[u]) < 0) {
      swap(this.list, i, u, this.lookupKeyToIndex);
      i = u;
      u = getParent(i);
    }
  } else {
    heapify(this, i);
  }
};

BinaryHeap.prototype.popAny = function (lookupKey) {
  if (null == this.lookupKeyToIndex[lookupKey]) return null;

  if (0 == this.list.length) {
    return null;
  }

  if (1 == this.list.length) {
    delete this.lookupKeyToIndex[Object.keys(this.lookupKeyToIndex)[0]];
    return this.list.shift();
  }

  var i = this.lookupKeyToIndex[lookupKey];


  var old = this.list[i];
  delete this.lookupKeyToIndex[old.lookupKey];

  this.list[i] = this.list.pop();
  this.lookupKeyToIndex[this.list[i].lookupKey] = i;

  let u = getParent(i);
  if (null != u && this.compare(this.list[i], this.list[u]) < 0) {
    while (null != u && this.compare(this.list[i], this.list[u]) < 0) {
      swap(this.list, i, u, this.lookupKeyToIndex);
      i = u;
      u = getParent(i);
    }
  } else {
    heapify(this, i);
  }
  
  return old;
};

/**
 * @return {boolean} Whether the heap is empty.
 */
BinaryHeap.prototype.isEmpty = function () {
  return 0 == this.list.length;
};

/**
 * @return {number} The size of the heap.
 */
BinaryHeap.prototype.size = function () {
  return this.list.length;
};

/**
 * Compares two nodes with each other.
 *
 * @private
 * @param {Object} a The first key to compare.
 * @param {Object} b The second key to compare.
 * @return -1, 0 or 1 if a < b, a == b or a > b respectively.
 */
BinaryHeap.prototype.compare = function (a, b) {
  if (a.key > b.key) {
    return 1;
  }
  if (a.key < b.key) {
    return -1;
  }
  return 0;
};

/**
 * Heapifies a node.
 *
 * @private
 * @param {BinaryHeap} heap The heap containing the node to heapify.
 * @param {number} i The index of the node to heapify.
 */
function heapify(heap, i) {
  let cur = i;
  let smallest = -1;
  while (cur != smallest) {
    const l = getLeft(cur);
    const r = getRight(cur);
    
    smallest = cur;
    if (l < heap.list.length &&
        heap.compare(heap.list[l], heap.list[smallest]) < 0) {
      smallest = l;
    }
    if (r < heap.list.length &&
        heap.compare(heap.list[r], heap.list[smallest]) < 0) {
      smallest = r;
    }

    if (smallest !== cur) {
      swap(heap.list, cur, smallest, heap.lookupKeyToIndex);
      cur = smallest;
      smallest = -1;
    }
  }
}

/**
 * Swaps two values in an array.
 *
 * @private
 * @param {Array} array The array to swap on.
 * @param {number} a The index of the first element.
 * @param {number} b The index of the second element.
 */
function swap(array, a, b, lookupKeyToIndex) {
  var aLookupKey = array[a].lookupKey;
  var bLookupKey = array[b].lookupKey;

  var temp = array[a];
  array[a] = array[b];
  array[b] = temp;

  lookupKeyToIndex[aLookupKey] = b; 
  lookupKeyToIndex[bLookupKey] = a; 
}

/**
 * Gets the index of a node's parent.
 *
 * @private
 * @param {number} i The index of the node to get the parent of.
 * @return {number} The index of the node's parent.
 */
function getParent(i) {
  if (0 == i) {
    return null;
  }
  return Math.floor((i - 1) / 2);
}

/**
 * Gets the index of a node's left child.
 *
 * @private
 * @param {number} i The index of the node to get the left child of.
 * @return {number} The index of the node's left child.
 */
function getLeft(i) {
  return 2 * i + 1;
}

/**
 * Gets the index of a node's right child.
 *
 * @private
 * @param {number} i The index of the node to get the right child of.
 * @return {number} The index of the node's right child.
 */
function getRight(i) {
  return 2 * i + 2;
}

/**
 * Creates a node.
 *
 * @constructor
 * @param {Object} key The key of the new node.
 * @param {Object} value The value of the new node.
 */
function Node(key, value, lookupKey) {
  this.key = key;
  this.value = value;
  this.lookupKey = lookupKey;
}

module.exports = BinaryHeap;
