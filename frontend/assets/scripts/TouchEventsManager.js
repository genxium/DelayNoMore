window.DIRECTION_DECODER = [
  // The 3rd value matches low-precision constants in backend.
  [0, 0],
  [0, +2],
  [0, -2],
  [+2, 0],
  [-2, 0],
  [+1, +1],
  [-1, -1],
  [+1, -1],
  [-1, +1],
];

cc.Class({
  extends: cc.Component,
  properties: {
    // For joystick begins.
    translationListenerNode: {
      default: null,
      type: cc.Node
    },
    zoomingListenerNode: {
      default: null,
      type: cc.Node
    },
    stickhead: {
      default: null,
      type: cc.Node
    },
    base: {
      default: null,
      type: cc.Node
    },
    joyStickEps: {
      default: 0.10,
      type: cc.Float
    },
    magicLeanLowerBound: {
      default: 0.1,
      type: cc.Float
    },
    magicLeanUpperBound: {
      default: 0.9,
      type: cc.Float
    },
    // For joystick ends.
    linearScaleFacBase: {
      default: 1.00,
      type: cc.Float
    },
    minScale: {
      default: 1.00,
      type: cc.Float
    },
    maxScale: {
      default: 2.50,
      type: cc.Float
    },
    maxMovingBufferLength: {
      default: 1,
      type: cc.Integer
    },
    zoomingScaleFacBase: {
      default: 0.10,
      type: cc.Float
    },
    zoomingSpeedBase: {
      default: 4.0,
      type: cc.Float
    },
    linearSpeedBase: {
      default: 320.0,
      type: cc.Float
    },
    canvasNode: {
      default: null,
      type: cc.Node
    },
    mapNode: {
      default: null,
      type: cc.Node
    },
    linearMovingEps: {
      default: 0.10,
      type: cc.Float
    },
    scaleByEps: {
      default: 0.0375,
      type: cc.Float
    },
    btnA: {
      default: null,
      type: cc.Node
    },
    btnB: {
      default: null,
      type: cc.Node
    },
  },

  start() {},

  onLoad() {
    this.cachedStickHeadPosition = cc.v2(0.0, 0.0);
    this.cachedBtnUpLevel = 0;
    this.cachedBtnDownLevel = 0;
    this.cachedBtnLeftLevel = 0;
    this.cachedBtnRightLevel = 0;

    this.cachedBtnALevel = 0;
    this.btnAEdgeTriggerLock = false;
    this.cachedBtnBLevel = 0;
    this.btnBEdgeTriggerLock = false;

    this.canvasNode = this.mapNode.parent;
    this.mainCameraNode = this.canvasNode.getChildByName("Main Camera"); // Cannot drag and assign the `mainCameraNode` from CocosCreator EDITOR directly, otherwise it'll cause an infinite loading time, till v2.1.0.
    this.mainCamera = this.mainCameraNode.getComponent(cc.Camera);
    this.activeDirection = {
      dx: 0.0,
      dy: 0.0
    };
    this.maxHeadDistance = (0.5 * this.base.width);

    this._initTouchEvent();
    this._cachedMapNodePosTarget = [];
    this._cachedZoomRawTarget = null;

    this.mapScriptIns = this.mapNode.getComponent("Map");
    this.initialized = true;
  },

  _initTouchEvent() {
    const self = this;
    const translationListenerNode = (self.translationListenerNode ? self.translationListenerNode : self.mapNode);
    const zoomingListenerNode = (self.zoomingListenerNode ? self.zoomingListenerNode : self.mapNode);

    translationListenerNode.on(cc.Node.EventType.TOUCH_START, function(event) {
      self._touchStartEvent(event);
    });
    translationListenerNode.on(cc.Node.EventType.TOUCH_MOVE, function(event) {
      self._translationEvent(event);
    });
    translationListenerNode.on(cc.Node.EventType.TOUCH_END, function(event) {
      self._touchEndEvent(event);
    });
    translationListenerNode.on(cc.Node.EventType.TOUCH_CANCEL, function(event) {
      self._touchEndEvent(event);
    });
    translationListenerNode.inTouchPoints = new Map();

    /*
    zoomingListenerNode.on(cc.Node.EventType.TOUCH_START, function(event) {
      self._touchStartEvent(event);
    });
    zoomingListenerNode.on(cc.Node.EventType.TOUCH_MOVE, function(event) {
      self._zoomingEvent(event);
    });
    zoomingListenerNode.on(cc.Node.EventType.TOUCH_END, function(event) {
      self._touchEndEvent(event);
    });
    zoomingListenerNode.on(cc.Node.EventType.TOUCH_CANCEL, function(event) {
      self._touchEndEvent(event);
    });
    zoomingListenerNode.inTouchPoints = new Map();
    */

    if (self.btnA) {
      self.btnA.on(cc.Node.EventType.TOUCH_START, function(evt) {
        self._triggerEdgeBtnA(true);
        evt.target.runAction(cc.scaleTo(0.1, 0.3));
      });
      self.btnA.on(cc.Node.EventType.TOUCH_END, function(evt) {
        self._triggerEdgeBtnA(false);
        evt.target.runAction(cc.scaleTo(0.1, 1.0));
      });
      self.btnA.on(cc.Node.EventType.TOUCH_CANCEL, function(evt) {
        self._triggerEdgeBtnA(false);
        evt.target.runAction(cc.scaleTo(0.1, 1.0));
      });
    }

    if (self.btnB) {
      self.btnB.on(cc.Node.EventType.TOUCH_START, function(evt) {
        self._triggerEdgeBtnB(true);
        evt.target.runAction(cc.scaleTo(0.1, 0.3));
      });
      self.btnB.on(cc.Node.EventType.TOUCH_END, function(evt) {
        self._triggerEdgeBtnB(false);
        evt.target.runAction(cc.scaleTo(0.1, 1.0));
      });
      self.btnB.on(cc.Node.EventType.TOUCH_CANCEL, function(evt) {
        self._triggerEdgeBtnB(false);
        evt.target.runAction(cc.scaleTo(0.1, 1.0));
      });
    }

    // Setup keyboard controls for the ease of attach debugging
    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, function(evt) {
      switch (evt.keyCode) {
        case cc.macro.KEY.w:
          self.cachedBtnUpLevel = 0;
          self.cachedBtnDownLevel = 0;
          self.cachedBtnLeftLevel = 0;
          self.cachedBtnRightLevel = 0;
          self.cachedBtnUpLevel = 1;
          break;
        case cc.macro.KEY.s:
          self.cachedBtnUpLevel = 0;
          self.cachedBtnDownLevel = 0;
          self.cachedBtnLeftLevel = 0;
          self.cachedBtnRightLevel = 0;
          self.cachedBtnDownLevel = 1;
          break;
        case cc.macro.KEY.a:
          self.cachedBtnUpLevel = 0;
          self.cachedBtnDownLevel = 0;
          self.cachedBtnLeftLevel = 0;
          self.cachedBtnRightLevel = 0;
          self.cachedBtnLeftLevel = 1;
          break;
        case cc.macro.KEY.d:
          self.cachedBtnUpLevel = 0;
          self.cachedBtnDownLevel = 0;
          self.cachedBtnLeftLevel = 0;
          self.cachedBtnRightLevel = 0;
          self.cachedBtnRightLevel = 1;
          break;
        case cc.macro.KEY.h:
          self._triggerEdgeBtnA(true);
          break;
        case cc.macro.KEY.j:
          self._triggerEdgeBtnB(true);
          break;
        default:
          break;
      }
    }, this);

    cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, function(evt) {
      switch (evt.keyCode) {
        case cc.macro.KEY.w:
          self.cachedBtnUpLevel = 0;
          break;
        case cc.macro.KEY.s:
          self.cachedBtnDownLevel = 0;
          break;
        case cc.macro.KEY.a:
          self.cachedBtnLeftLevel = 0;
          break;
        case cc.macro.KEY.d:
          self.cachedBtnRightLevel = 0;
          break;
        case cc.macro.KEY.h:
          self._triggerEdgeBtnA(false);
          break;
        case cc.macro.KEY.j:
          self._triggerEdgeBtnB(false);
          break;
        default:
          break;
      }
    }, this);
  },

  _isMapOverMoved(mapTargetPos) {
    const virtualPlayerPos = cc.v2(-mapTargetPos.x, -mapTargetPos.y);
    return tileCollisionManager.isOutOfMapNode(this.mapNode, virtualPlayerPos);
  },

  _touchStartEvent(event) {
    const theListenerNode = event.target;
    for (let touch of event._touches) {
      theListenerNode.inTouchPoints.set(touch._id, touch);
    }
  },

  _translationEvent(event) {
    if (ALL_MAP_STATES.VISUAL != this.mapScriptIns.state) {
      return;
    }
    const theListenerNode = event.target;
    const linearScaleFacBase = this.linearScaleFacBase; // Not used yet.
    if (1 != theListenerNode.inTouchPoints.size) {
      return;
    }
    if (!theListenerNode.inTouchPoints.has(event.currentTouch._id)) {
      return;
    }
    const diffVec = event.currentTouch._point.sub(event.currentTouch._startPoint);
    const distance = diffVec.mag();
    const overMoved = (distance > this.maxHeadDistance);
    if (overMoved) {
      const ratio = (this.maxHeadDistance / distance);
      this.cachedStickHeadPosition = diffVec.mul(ratio);
    } else {
      const ratio = (distance / this.maxHeadDistance);
      this.cachedStickHeadPosition = diffVec.mul(ratio);
    }
  },

  _zoomingEvent(event) {
    if (ALL_MAP_STATES.VISUAL != this.mapScriptIns.state) {
      return;
    }
    const theListenerNode = event.target;
    if (2 != theListenerNode.inTouchPoints.size) {
      return;
    }
    if (2 == event._touches.length) {
      const firstTouch = event._touches[0];
      const secondTouch = event._touches[1];

      const startMagnitude = firstTouch._startPoint.sub(secondTouch._startPoint).mag();
      const currentMagnitude = firstTouch._point.sub(secondTouch._point).mag();

      let scaleBy = (currentMagnitude / startMagnitude);
      scaleBy = 1 + (scaleBy - 1) * this.zoomingScaleFacBase;
      if (1 < scaleBy && Math.abs(scaleBy - 1) < this.scaleByEps) {
        // Jitterring.
        cc.log(`ScaleBy == ${scaleBy} is just jittering.`);
        return;
      }
      if (1 > scaleBy && Math.abs(scaleBy - 1) < 0.5 * this.scaleByEps) {
        // Jitterring.
        cc.log(`ScaleBy == ${scaleBy} is just jittering.`);
        return;
      }
      if (!this.mainCamera) return;
      const targetScale = this.mainCamera.zoomRatio * scaleBy;
      if (this.minScale > targetScale || targetScale > this.maxScale) {
        return;
      }
      this.mainCamera.zoomRatio = targetScale;
      for (let child of this.mainCameraNode.children) {
        child.setScale(1 / targetScale);
      }
    }
  },

  _touchEndEvent(event) {
    const theListenerNode = event.target;
    do {
      if (!theListenerNode.inTouchPoints.has(event.currentTouch._id)) {
        break;
      }
      const diffVec = event.currentTouch._point.sub(event.currentTouch._startPoint);
      const diffVecMag = diffVec.mag();
      if (this.linearMovingEps <= diffVecMag) {
        break;
      }
      // Only triggers map-state-switch when `diffVecMag` is sufficiently small.

      if (ALL_MAP_STATES.VISUAL != this.mapScriptIns.state) {
        break;
      }

    // TODO: Handle single-finger-click event.
    } while (false);
    for (let touch of event._touches) {
      if (touch) {
        theListenerNode.inTouchPoints.delete(touch._id);
      }
    }
  },

  _touchCancelEvent(event) {},

  update(dt) {
    if (this.inMultiTouch) return;
    if (true != this.initialized) return;
    const self = this;
    // Keyboard takes top priority
    let keyboardDiffVec = cc.v2(0, 0);
    if (1 == this.cachedBtnUpLevel) {
      if (1 == this.cachedBtnLeftLevel) {
        keyboardDiffVec = cc.v2(-1.0, +1.0);
      } else if (1 == this.cachedBtnRightLevel) {
        keyboardDiffVec = cc.v2(+1.0, +1.0);
      } else {
        keyboardDiffVec = cc.v2(0.0, +1.0);
      }
    } else if (1 == this.cachedBtnDownLevel) {
      if (1 == this.cachedBtnLeftLevel) {
        keyboardDiffVec = cc.v2(-1.0, -1.0);
      } else if (1 == this.cachedBtnRightLevel) {
        keyboardDiffVec = cc.v2(+1.0, -1.0);
      } else {
        keyboardDiffVec = cc.v2(0.0, -1.0);
      }
    } else if (1 == this.cachedBtnLeftLevel) {
      keyboardDiffVec = cc.v2(-1.0, 0.0);
    } else if (1 == this.cachedBtnRightLevel) {
      keyboardDiffVec = cc.v2(+1.0, 0.0);
    }
    if (0 != keyboardDiffVec.x || 0 != keyboardDiffVec.y) {
      this.cachedStickHeadPosition = keyboardDiffVec.mul(this.maxHeadDistance / keyboardDiffVec.mag());
    }
    this.stickhead.setPosition(this.cachedStickHeadPosition);

    const translationListenerNode = (self.translationListenerNode ? self.translationListenerNode : self.mapNode);
    if (0 == translationListenerNode.inTouchPoints.size
      &&
      (0 == keyboardDiffVec.x && 0 == keyboardDiffVec.y)
    ) {
      this.cachedStickHeadPosition = cc.v2(0, 0); // Important reset!
    }
  },

  discretizeDirection(continuousDx, continuousDy, eps) {
    let ret = {
      dx: 0,
      dy: 0,
      encodedIdx: 0
    };
    if (Math.abs(continuousDx) < eps && Math.abs(continuousDy) < eps) {
      return ret;
    }

    const criticalRatio = continuousDy / continuousDx;
    if (Math.abs(criticalRatio) < this.magicLeanLowerBound) {
      ret.dy = 0;
      if (0 < continuousDx) {
        ret.dx = +2; // right 
        ret.encodedIdx = 3;
      } else {
        ret.dx = -2; // left 
        ret.encodedIdx = 4;
      }
    } else if (Math.abs(criticalRatio) > this.magicLeanUpperBound) {
      ret.dx = 0;
      if (0 < continuousDy) {
        ret.dy = +2; // up
        ret.encodedIdx = 1;
      } else {
        ret.dy = -2; // down
        ret.encodedIdx = 2;
      }
    } else {
      if (0 < continuousDx) {
        if (0 < continuousDy) {
          ret.dx = +1;
          ret.dy = +1;
          ret.encodedIdx = 5;
        } else {
          ret.dx = +1;
          ret.dy = -1;
          ret.encodedIdx = 7;
        }
      } else {
        // 0 >= continuousDx
        if (0 < continuousDy) {
          ret.dx = -1;
          ret.dy = +1;
          ret.encodedIdx = 8;
        } else {
          ret.dx = -1;
          ret.dy = -1;
          ret.encodedIdx = 6;
        }
      }
    }

    return ret;
  },

  getEncodedInput() {
    const discretizedDir = this.discretizeDirection(this.stickhead.x, this.stickhead.y, this.joyStickEps).encodedIdx; // There're only 9 dirs, thus using only the lower 4-bits
    const btnALevel = (this.cachedBtnALevel << 4);
    const btnBLevel = (this.cachedBtnBLevel << 5);

    this.btnAEdgeTriggerLock = false;
    this.btnBEdgeTriggerLock = false;
    return (btnBLevel + btnALevel + discretizedDir);
  },

  decodeInput(encodedInput) {
    const encodedDirection = (encodedInput & 15);
    const mappedDirection = window.DIRECTION_DECODER[encodedDirection];
    if (null == mappedDirection) {
      console.error("Unexpected encodedDirection = ", encodedDirection);
    }
    const btnALevel = ((encodedInput >> 4) & 1);
    const btnBLevel = ((encodedInput >> 5) & 1);
    return window.pb.protos.InputFrameDecoded.create({
      dx: mappedDirection[0],
      dy: mappedDirection[1],
      btnALevel: btnALevel,
      btnBLevel: btnBLevel,
    });
  },

  _triggerEdgeBtnA(rising) {
    if (!this.btnAEdgeTriggerLock && (rising ? 0 : 1) == this.cachedBtnALevel) {
      this.cachedBtnALevel = (rising ? 1 : 0);
      this.btnAEdgeTriggerLock = true;
    }
  },

  _triggerEdgeBtnB(rising) {
    if (!this.btnBEdgeTriggerLock && (rising ? 0 : 1) == this.cachedBtnBLevel) {
      this.cachedBtnBLevel = (rising ? 1 : 0);
      this.btnBEdgeTriggerLock = true;
    }
  },
});
