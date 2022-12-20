const RingBuffer = require('./RingBuffer');

window.UPSYNC_MSG_ACT_HB_PING = 1;
window.UPSYNC_MSG_ACT_PLAYER_CMD = 2;
window.UPSYNC_MSG_ACT_PLAYER_COLLIDER_ACK = 3;

window.DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED = -98;
window.DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START = -1;
window.DOWNSYNC_MSG_ACT_BATTLE_START = 0;
window.DOWNSYNC_MSG_ACT_HB_REQ = 1;
window.DOWNSYNC_MSG_ACT_INPUT_BATCH = 2;
window.DOWNSYNC_MSG_ACT_BATTLE_STOPPED = 3;
window.DOWNSYNC_MSG_ACT_FORCED_RESYNC = 4;

window.sendSafely = function(msgStr) {
  /**
  * - "If the data can't be sent (for example, because it needs to be buffered but the buffer is full), the socket is closed automatically."
  *
  * from https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send.
  */
  if (null == window.clientSession || window.clientSession.readyState != WebSocket.OPEN) return false;
  window.clientSession.send(msgStr);
}

window.sendUint8AsBase64Safely = function(msgUint8Arr) {
  if (null == window.clientSession || window.clientSession.readyState != WebSocket.OPEN) return false;
  window.clientSession.send(_uint8ToBase64(msgUint8Arr));
}

window.closeWSConnection = function(code, reason) {
  if (null == window.clientSession || window.clientSession.readyState != WebSocket.OPEN) {
    console.log(`"window.clientSession" is already closed or destroyed.`);
    return;
  }
  console.log(`Closing "window.clientSession" from the client-side.`);
  window.clientSession.close(code, reason);
}

window.getBoundRoomIdFromPersistentStorage = function() {
  const boundRoomIdExpiresAt = parseInt(cc.sys.localStorage.getItem("boundRoomIdExpiresAt"));
  if (!boundRoomIdExpiresAt || Date.now() >= boundRoomIdExpiresAt) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    return null;
  }
  return cc.sys.localStorage.getItem("boundRoomId");
};

window.clearBoundRoomIdInBothVolatileAndPersistentStorage = function() {
  window.boundRoomId = null;
  cc.sys.localStorage.removeItem("boundRoomId");
  cc.sys.localStorage.removeItem("boundRoomIdExpiresAt");
};

window.clearSelfPlayer = function() {
  cc.sys.localStorage.removeItem("selfPlayer");
};

window.boundRoomId = getBoundRoomIdFromPersistentStorage();
window.handleHbRequirements = function(resp) {
  if (constants.RET_CODE.OK != resp.ret) return;
  if (null == window.boundRoomId) {
    window.boundRoomId = resp.bciFrame.boundRoomId;
    cc.sys.localStorage.setItem('boundRoomId', window.boundRoomId);
    cc.sys.localStorage.setItem('boundRoomIdExpiresAt', Date.now() + 10 * 60 * 1000); // Temporarily hardcoded, for `boundRoomId` only.
  }

  if (window.handleBattleColliderInfo) {
    window.handleBattleColliderInfo(resp.bciFrame);
  }
};

function _uint8ToBase64(uint8Arr) {
  return window.btoa(uint8Arr);
}

function _base64ToUint8Array(base64) {
  var origBytes = null;
  if (null != window.atob) {
    var origBinaryStr = window.atob(base64);
    var origLen = origBinaryStr.length;
    origBytes = new Uint8Array(origLen);
    for (var i = 0; i < origLen; i++) {
      origBytes[i] = origBinaryStr.charCodeAt(i);
    }
    return origBytes;
  } else {
    return null;
  }
}

function _base64ToArrayBuffer(base64) {
  return _base64ToUint8Array(base64).buffer;
}

window.getExpectedRoomIdSync = function() {
  const qDict = window.getQueryParamDict();
  if (qDict) {
    return qDict["expectedRoomId"];
  } else {
    if (window.history && window.history.state) {
      return window.history.state.expectedRoomId;
    }
  }

  return null;
};

window.initPersistentSessionClient = function(onopenCb, expectedRoomId) {
  if (window.clientSession && window.clientSession.readyState == WebSocket.OPEN) {
    if (null != onopenCb) {
      onopenCb();
    }
    return;
  }

  const selfPlayerStr = cc.sys.localStorage.getItem("selfPlayer");
  const selfPlayer = null == selfPlayerStr ? null : JSON.parse(selfPlayerStr);
  const intAuthToken = null == selfPlayer ? "" : selfPlayer.intAuthToken;

  let urlToConnect = backendAddress.PROTOCOL.replace('http', 'ws') + '://' + backendAddress.HOST + ":" + backendAddress.PORT + backendAddress.WS_PATH_PREFIX + "?intAuthToken=" + intAuthToken;

  if (null != expectedRoomId) {
    console.log("initPersistentSessionClient with expectedRoomId == " + expectedRoomId);
    urlToConnect = urlToConnect + "&expectedRoomId=" + expectedRoomId;
  } else {
    window.boundRoomId = getBoundRoomIdFromPersistentStorage();
    if (null != window.boundRoomId) {
      console.log("initPersistentSessionClient with boundRoomId == " + boundRoomId);
      urlToConnect = urlToConnect + "&boundRoomId=" + window.boundRoomId;
    }
  }

  const currentHistoryState = window.history && window.history.state ? window.history.state : {};

  const clientSession = new WebSocket(urlToConnect);
  clientSession.binaryType = 'arraybuffer'; // Make 'event.data' of 'onmessage' an "ArrayBuffer" instead of a "Blob"

  clientSession.onopen = function(evt) {
    console.log("The WS clientSession is opened.");
    window.clientSession = clientSession;
    if (null == onopenCb) return;
    onopenCb();
  };

  clientSession.onmessage = function(evt) {
    if (null == evt || null == evt.data) {
      return;
    }
    // FIXME: In practice, it seems like the thread invoking "onmessage" could be different from "Map.update(dt)", which makes it necessary to guard "recentRenderCache & recentInputCache" for "getOrPrefabInputFrameUpsync & rollbackAndChase & onRoomDownsyncFrame & onInputFrameDownsyncBatch" to avoid mysterious RAM contamination, but there's no explicit mutex in JavaScript for browsers -- this issue is found in Firefox (108.0.1, 64-bit, Windows 11), but not in Chrome (108.0.5359.125, Official Build, 64-bit, Windows 11) -- just breakpoint in "Map.rollbackAndChase" then see whether the logs of "onmessage" can still be printed and whether the values of "recentRenderCache & recentInputCache" change in console). 
    try {
      const resp = window.pb.protos.WsResp.decode(new Uint8Array(evt.data));
      //console.log(`Got non-empty onmessage decoded: resp.act=${resp.act}`);
      switch (resp.act) {
        case window.DOWNSYNC_MSG_ACT_HB_REQ:
          window.handleHbRequirements(resp);
          break;
        case window.DOWNSYNC_MSG_ACT_PLAYER_ADDED_AND_ACKED:
          mapIns.onPlayerAdded(resp.rdf);
          break;
        case window.DOWNSYNC_MSG_ACT_BATTLE_READY_TO_START:
          mapIns.onBattleReadyToStart(resp.rdf);
          break;
        case window.DOWNSYNC_MSG_ACT_BATTLE_START:
          mapIns.onRoomDownsyncFrame(resp.rdf);
          break;
        case window.DOWNSYNC_MSG_ACT_BATTLE_STOPPED:
          mapIns.onBattleStopped();
          break;
        case window.DOWNSYNC_MSG_ACT_INPUT_BATCH:
          mapIns.onInputFrameDownsyncBatch(resp.inputFrameDownsyncBatch);
          break;
        case window.DOWNSYNC_MSG_ACT_FORCED_RESYNC:
          if (null == resp.inputFrameDownsyncBatch || 0 >= resp.inputFrameDownsyncBatch.length) {
            console.error(`Got empty inputFrameDownsyncBatch upon resync@localRenderFrameId=${mapIns.renderFrameId}, @lastAllConfirmedRenderFrameId=${mapIns.lastAllConfirmedRenderFrameId}, @lastAllConfirmedInputFrameId=${mapIns.lastAllConfirmedInputFrameId}, @chaserRenderFrameId=${mapIns.chaserRenderFrameId}, @localRecentInputCache=${mapIns._stringifyRecentInputCache(false)}, the incoming resp=${JSON.stringify(resp, null, 2)}`);
            return;
          }
          mapIns.onRoomDownsyncFrame(resp.rdf, resp.inputFrameDownsyncBatch);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("Unexpected error when parsing data of:", evt.data, e);
    }
  };

  clientSession.onerror = function(evt) {
    console.error("Error caught on the WS clientSession: ", evt);
    window.clearLocalStorageAndBackToLoginScene(true);
  };

  clientSession.onclose = function(evt) {
    // [WARNING] The callback "onclose" might be called AFTER the webpage is refreshed with "1001 == evt.code".
    console.warn(`The WS clientSession is closed: evt=${JSON.stringify(evt)}, evt.code=${evt.code}`);
    switch (evt.code) {
      case constants.RET_CODE.BATTLE_STOPPED:
        // deliberately do nothing
        break;
      case constants.RET_CODE.PLAYER_NOT_ADDABLE_TO_ROOM:
      case constants.RET_CODE.PLAYER_NOT_READDABLE_TO_ROOM:
        window.clearBoundRoomIdInBothVolatileAndPersistentStorage(); // To favor the player to join other rooms
        mapIns.onManualRejoinRequired("Couldn't join any room at the moment, please retry");
        break;
      case constants.RET_CODE.ACTIVE_WATCHDOG:
        mapIns.onManualRejoinRequired("Disconnected due to long-time inactivity, please rejoin");
        break;
      case constants.RET_CODE.UNKNOWN_ERROR:
      case constants.RET_CODE.MYSQL_ERROR:
      case constants.RET_CODE.PLAYER_NOT_FOUND:
      case constants.RET_CODE.PLAYER_CHEATING:
      case 1006: // Peer(i.e. the backend) gone unexpectedly 
        window.clearLocalStorageAndBackToLoginScene(true);
        break;
      default:
        break;
    }
  };
};

window.clearLocalStorageAndBackToLoginScene = function(shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
  console.warn("+++++++ Calling `clearLocalStorageAndBackToLoginScene`");

  if (window.mapIns && window.mapIns.musicEffectManagerScriptIns) {
    window.mapIns.musicEffectManagerScriptIns.stopAllMusic();
  }

  window.closeWSConnection();
  window.clearSelfPlayer();
  if (true != shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
  }
  cc.director.loadScene('login');
};

