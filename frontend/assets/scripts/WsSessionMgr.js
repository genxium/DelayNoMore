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
window.DOWNSYNC_MSG_ACT_PEER_INPUT_BATCH = 5;
window.DOWNSYNC_MSG_ACT_PEER_UDP_ADDR = 6;

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
  console.log(`Closing "window.clientSession" from the client-side with code=${code}.`);
  window.clientSession.close(code, reason);
}

window.getBoundRoomIdFromPersistentStorage = function() {
  const boundRoomIdExpiresAt = parseInt(cc.sys.localStorage.getItem("boundRoomIdExpiresAt"));
  if (!boundRoomIdExpiresAt || Date.now() >= boundRoomIdExpiresAt) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    return null;
  }
  const boundRoomIdStr = cc.sys.localStorage.getItem("boundRoomId");
  return (null == boundRoomIdStr ? null : parseInt(boundRoomIdStr));
};

window.getBoundRoomCapacityFromPersistentStorage = function() {
  const boundRoomIdExpiresAt = parseInt(cc.sys.localStorage.getItem("boundRoomIdExpiresAt"));
  if (!boundRoomIdExpiresAt || Date.now() >= boundRoomIdExpiresAt) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    return null;
  }
  const boundRoomCapacityStr = cc.sys.localStorage.getItem("boundRoomCapacity");
  return (null == boundRoomCapacityStr ? null : parseInt(boundRoomCapacityStr));
};

window.getChosenSpeciesIdFromPersistentStorage = function() {
  const boundRoomIdExpiresAt = parseInt(cc.sys.localStorage.getItem("boundRoomIdExpiresAt"));
  if (!boundRoomIdExpiresAt || Date.now() >= boundRoomIdExpiresAt) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
    return null;
  }
  const chosenSpeciesIdStr = cc.sys.localStorage.getItem("chosenSpeciesId");
  return (null == chosenSpeciesIdStr ? 0 : parseInt(chosenSpeciesIdStr));
};

window.clearBoundRoomIdInBothVolatileAndPersistentStorage = function() {
  window.boundRoomId = null;
  cc.sys.localStorage.removeItem("boundRoomId");
  cc.sys.localStorage.removeItem("boundRoomCapacity");
  cc.sys.localStorage.removeItem("chosenSpeciesId");
  cc.sys.localStorage.removeItem("boundRoomIdExpiresAt");
};

window.clearSelfPlayer = function() {
  cc.sys.localStorage.removeItem("selfPlayer");
};

window.boundRoomId = getBoundRoomIdFromPersistentStorage();
window.boundRoomCapacity = getBoundRoomCapacityFromPersistentStorage();
window.handleHbRequirements = function(resp) {
  console.log(`Handle hb requirements #1`);
  if (constants.RET_CODE.OK != resp.ret) return;
  // The assignment of "window.mapIns" is inside "Map.onLoad", which precedes "initPersistentSessionClient".
  window.mapIns.selfPlayerInfo = JSON.parse(cc.sys.localStorage.getItem('selfPlayer')); // This field is kept for distinguishing "self" and "others".
  window.mapIns.selfPlayerInfo.id = window.mapIns.selfPlayerInfo.playerId;
  window.mapIns.selfPlayerInfo.joinIndex = resp.peerJoinIndex;
  console.log(`Handle hb requirements #2`);
  if (null == window.boundRoomId || null == window.boundRoomCapacity) {
    window.boundRoomId = resp.bciFrame.boundRoomId;
    window.boundRoomCapacity = resp.bciFrame.boundRoomCapacity;
    cc.sys.localStorage.setItem('boundRoomId', window.boundRoomId);
    cc.sys.localStorage.setItem('boundRoomCapacity', window.boundRoomCapacity);
    cc.sys.localStorage.setItem('chosenSpeciesId', window.chosenSpeciesId);
    cc.sys.localStorage.setItem('boundRoomIdExpiresAt', Date.now() + 10 * 60 * 1000); // Temporarily hardcoded, for `boundRoomId` only.
  }
  console.log(`Handle hb requirements #3`);
  if (window.handleBattleColliderInfo) {
    window.handleBattleColliderInfo(resp.bciFrame);
  }
  console.log(`Handle hb requirements #4`);

  if (!cc.sys.isNative) {
    console.log(`Handle hb requirements #5, web`);
    window.initSecondarySession(null, window.boundRoomId);
  } else {
    console.log(`Handle hb requirements #5, native, bciFrame.battleUdpTunnel=${resp.bciFrame.battleUdpTunnel}, selfPlayerInfo=${JSON.stringify(window.mapIns.selfPlayerInfo)}`);
    const res1 = DelayNoMore.UdpSession.openUdpSession(8888 + window.mapIns.selfPlayerInfo.joinIndex);
    window.mapIns.selfPlayerInfo.udpTunnelAuthKey = resp.bciFrame.battleUdpTunnel.authKey;
    const intAuthToken = window.mapIns.selfPlayerInfo.intAuthToken;
    const authKey = Math.floor(Math.random() * 65535);
    window.mapIns.selfPlayerInfo.authKey = authKey;
    const holePunchData = window.pb.protos.HolePunchUpsync.encode({
      boundRoomId: window.boundRoomId,
      intAuthToken: intAuthToken,
      authKey: authKey,
    }).finish();
    const udpTunnelHolePunchData = window.pb.protos.WsReq.encode({
      msgId: Date.now(),
      playerId: window.mapIns.selfPlayerInfo.id,
      act: window.UPSYNC_MSG_ACT_PLAYER_CMD,
      authKey: resp.bciFrame.battleUdpTunnel.authKey,
    }).finish();
    const res2 = DelayNoMore.UdpSession.punchToServer(backendAddress.HOST, 3000, holePunchData, resp.bciFrame.battleUdpTunnel.port, udpTunnelHolePunchData);
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
    window.boundRoomCapacity = getBoundRoomCapacityFromPersistentStorage();
    if (null != window.boundRoomId) {
      console.log("initPersistentSessionClient with boundRoomId == " + boundRoomId);
      urlToConnect = urlToConnect + "&boundRoomId=" + window.boundRoomId;
    }
  }

  if (null == window.chosenSpeciesId) {
    window.chosenSpeciesId = getChosenSpeciesIdFromPersistentStorage();
  }
  if (null != window.chosenSpeciesId) {
    urlToConnect = urlToConnect + "&speciesId=" + window.chosenSpeciesId;
  }

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
        case window.DOWNSYNC_MSG_ACT_PEER_UDP_ADDR:
          console.warn(`Got DOWNSYNC_MSG_ACT_PEER_UDP_ADDR resp=${JSON.stringify(resp, null, 2)}`);
          if (cc.sys.isNative) {
            const peerJoinIndex = resp.peerJoinIndex;
            const peerAddrList = resp.rdf.peerUdpAddrList;
            console.log(`Got DOWNSYNC_MSG_ACT_PEER_UDP_ADDR peerAddrList=${JSON.stringify(peerAddrList)}; boundRoomCapacity=${window.boundRoomCapacity}`);
            for (let j = 0; j < 3; ++j) {
              setTimeout(() => {
                DelayNoMore.UdpSession.upsertPeerUdpAddr(peerAddrList, window.boundRoomCapacity, window.mapIns.selfPlayerInfo.joinIndex); // In C++ impl it actually broadcasts the peer-punching message to all known peers within "window.boundRoomCapacity"
              }, j * 500);
            }
          }
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
    if (cc.sys.isNative) {
      if (mapIns.frameDataLoggingEnabled) {
        console.warn(`${mapIns._stringifyRdfIdToActuallyUsedInput()}
`);
      }
      DelayNoMore.UdpSession.closeUdpSession();
    }
    switch (evt.code) {
      case constants.RET_CODE.CLIENT_MISMATCHED_RENDER_FRAME:
        break;
      case constants.RET_CODE.BATTLE_STOPPED:
        // deliberately do nothing
        if (mapIns.frameDataLoggingEnabled) {
          console.warn(`${mapIns._stringifyRdfIdToActuallyUsedInput()}
`);
        }
        break;
      case constants.RET_CODE.SAME_PLAYER_ALREADY_IN_SAME_ROOM:
        mapIns.popupSimplePressToGo("You just logged into a conflicting account, please use a different account to retry", false, () => {
          window.clearLocalStorageAndBackToLoginScene(true);
        });
        break;
      case constants.RET_CODE.PLAYER_NOT_ADDABLE_TO_ROOM:
      case constants.RET_CODE.PLAYER_NOT_READDABLE_TO_ROOM:
        mapIns.popupSimplePressToGo("Couldn't join any room at the moment, please retry", false, () => {
          window.clearLocalStorageAndBackToLoginScene(true);
        });
        break;
      case constants.RET_CODE.ACTIVE_WATCHDOG:
        mapIns.popupSimplePressToGo("Couldn't join any room at the moment, please retry", false, () => {
          window.clearLocalStorageAndBackToLoginScene(true);
        });
        break;
      case constants.RET_CODE.UNKNOWN_ERROR:
      case constants.RET_CODE.MYSQL_ERROR:
      case constants.RET_CODE.PLAYER_NOT_FOUND:
      case constants.RET_CODE.PLAYER_CHEATING:
      case 1006: // Peer(i.e. the backend) gone unexpectedly, but not working for "cc.sys.isNative" 
        if (mapIns.frameDataLoggingEnabled) {
          console.warn(`${mapIns._stringifyRdfIdToActuallyUsedInput()}
`);
        }
        mapIns.popupSimplePressToGo("Disconnected unexpectedly, please retry", false, () => {
          window.clearLocalStorageAndBackToLoginScene(true);
        });
        break;
      default:
        break;
    }
  };
};

window.clearLocalStorageAndBackToLoginScene = function(shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
  console.warn("+++++++ Calling `clearLocalStorageAndBackToLoginScene`");
  window.clearSelfPlayer();
  if (true != shouldRetainBoundRoomIdInBothVolatileAndPersistentStorage) {
    window.clearBoundRoomIdInBothVolatileAndPersistentStorage();
  }

  if (window.mapIns && window.mapIns.musicEffectManagerScriptIns) {
    window.mapIns.musicEffectManagerScriptIns.stopAllMusic();
  }

  cc.director.loadScene('login');
};

// For secondary ws session
window.initSecondarySession = function(onopenCb, boundRoomId) {
  if (window.secondarySession && window.secondarySession.readyState == WebSocket.OPEN) {
    if (null != onopenCb) {
      onopenCb();
    }
    return;
  }

  const selfPlayerStr = cc.sys.localStorage.getItem("selfPlayer");
  const selfPlayer = null == selfPlayerStr ? null : JSON.parse(selfPlayerStr);
  const intAuthToken = null == selfPlayer ? "" : selfPlayer.intAuthToken;

  let urlToConnect = backendAddress.PROTOCOL.replace('http', 'ws') + '://' + backendAddress.HOST + ":" + backendAddress.PORT + "/tsrhtSecondary?isSecondary=true&intAuthToken=" + intAuthToken + "&boundRoomId=" + boundRoomId;

  const clientSession = new WebSocket(urlToConnect);
  clientSession.binaryType = 'arraybuffer'; // Make 'event.data' of 'onmessage' an "ArrayBuffer" instead of a "Blob"

  clientSession.onopen = function(evt) {
    console.warn("The secondary WS clientSession is opened.");
    window.secondarySession = clientSession;
    if (null == onopenCb) return;
    onopenCb();
  };

  clientSession.onmessage = function(evt) {
    if (null == evt || null == evt.data) {
      return;
    }
    try {
      const resp = window.pb.protos.WsResp.decode(new Uint8Array(evt.data));
      //console.log(`Got non-empty onmessage decoded: resp.act=${resp.act}`);
      switch (resp.act) {
        case window.DOWNSYNC_MSG_ACT_PEER_INPUT_BATCH:
          mapIns.onPeerInputFrameUpsync(resp.peerJoinIndex, resp.inputFrameDownsyncBatch, false);
          break;
        default:
          break;
      }
    } catch (e) {
      console.error("Secondary ws session, unexpected error when parsing data of:", evt.data, e);
    }
  };

  clientSession.onerror = function(evt) {
    console.error("Secondary ws session, error caught on the WS clientSession: ", evt);
  };

  clientSession.onclose = function(evt) {
    // [WARNING] The callback "onclose" might be called AFTER the webpage is refreshed with "1001 == evt.code".
    console.warn(`Secondary ws session is closed: evt=${JSON.stringify(evt)}, evt.code=${evt.code}`);
  };
};
