"use strict";

window.getQueryParamDict = function() {
  // Kindly note that only the first occurrence of duplicated keys will be picked up. 
  var query = cc.sys.platform == cc.sys.WECHAT_GAME ? '' : window.location.search.substring(1);
  var kvPairs = query.split('&');
  var toRet = {};
  for (var i = 0; i < kvPairs.length; ++i) {
    var kAndV = kvPairs[i].split('=');
    if (undefined === kAndV || null === kAndV || 2 != kAndV.length) return;
    var k = kAndV[0];
    var v = decodeURIComponent(kAndV[1]);
    toRet[k] = v;
  }
  return toRet;
}

let IS_USING_WKWECHAT_KERNEL = null;
window.isUsingWebkitWechatKernel = function() {
  if (null == IS_USING_WKWECHAT_KERNEL) {
    // The extraction of `browserType` might take a considerable amount of time in mobile browser kernels.
    IS_USING_WKWECHAT_KERNEL = (cc.sys.BROWSER_TYPE_WECHAT == cc.sys.browserType);  
  }
  return IS_USING_WKWECHAT_KERNEL;
};

let IS_USING_X5_BLINK_KERNEL = null;
window.isUsingX5BlinkKernel = function() {
  if (null == IS_USING_X5_BLINK_KERNEL) {
    // The extraction of `browserType` might take a considerable amount of time in mobile browser kernels.
    IS_USING_X5_BLINK_KERNEL = (cc.sys.BROWSER_TYPE_MOBILE_QQ == cc.sys.browserType);  
  }
  return IS_USING_X5_BLINK_KERNEL;
};

let IS_USING_X5_BLINK_KERNEL_OR_WKWECHAT_KERNEL = null;
window.isUsingX5BlinkKernelOrWebkitWeChatKernel = function() {
  if (null == IS_USING_X5_BLINK_KERNEL_OR_WKWECHAT_KERNEL) {
    // The extraction of `browserType` might take a considerable amount of time in mobile browser kernels.
    IS_USING_X5_BLINK_KERNEL_OR_WKWECHAT_KERNEL = (cc.sys.BROWSER_TYPE_MOBILE_QQ == cc.sys.browserType || cc.sys.BROWSER_TYPE_WECHAT == cc.sys.browserType); 
  }
  return IS_USING_X5_BLINK_KERNEL_OR_WKWECHAT_KERNEL;
};

window.getRandomInt = function(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

window.safelyAssignParent = function(proposedChild, proposedParent) {
  if (proposedChild.parent == proposedParent) return false;
  proposedChild.parent = proposedParent;
  return true;
};

window.get2dRotation = function(aCCNode) {
  // return aCCNode.rotation; // For cc2.0+ 
  return aCCNode.angle; // For cc2.1+ 
};

window.set2dRotation = function(aCCNode, clockwiseAngle) {
  // aCCNode.rotation = angle; // For cc2.0+ 
  aCCNode.angle = -clockwiseAngle; // For cc2.1+ 
};

window.setLocalZOrder = function(aCCNode, zIndex) {
  aCCNode.zIndex = zIndex; // For cc2.0+ 
};

window.getLocalZOrder = function(aCCNode) {
  return aCCNode.zIndex; // For cc2.0+ 
};

window.safelyAddChild = function(proposedParent, proposedChild) {
  if (proposedChild.parent == proposedParent) return false;
  setLocalZOrder(proposedChild, getLocalZOrder(proposedParent) + 1);
  proposedParent.addChild(proposedChild);
  return true;
};

window.setVisible = function(aCCNode) {
  aCCNode.opacity = 255;
};

window.setInvisible = function(aCCNode) {
  aCCNode.opacity = 0;
};

window.randomProperty = function (obj) {
  var keys = Object.keys(obj)
  return obj[keys[ keys.length * Math.random() << 0]];
};

window.gidSpriteFrameMap = {};
window.getOrCreateSpriteFrameForGid = function(gid, tiledMapInfo, tilesElListUnderTilesets) {
  if (null != gidSpriteFrameMap[gid]) return gidSpriteFrameMap[gid];
  if (false == gidSpriteFrameMap[gid]) return null;

  var tilesets = tiledMapInfo.getTilesets();
  var targetTileset = null;
  for (var i = 0; i < tilesets.length; ++i) {
    // TODO: Optimize by binary search.
    if (gid < tilesets[i].firstGid) continue;
    if (i < tilesets.length - 1) {
      if (gid >= tilesets[i + 1].firstGid) continue;
    }
    targetTileset = tilesets[i];
    break;
  }
  if (!targetTileset) return null;
  var tileIdWithinTileset = (gid - targetTileset.firstGid);
  var tilesElListUnderCurrentTileset = tilesElListUnderTilesets[targetTileset.name + ".tsx"];

  var targetTileEl = null;
  for (var tileIdx = 0; tileIdx < tilesElListUnderCurrentTileset.length; ++tileIdx) {
    var tmpTileEl = tilesElListUnderCurrentTileset[tileIdx];
    if (tileIdWithinTileset != parseInt(tmpTileEl.id)) continue;
    targetTileEl = tmpTileEl;
    break;
  }

  var tileId = tileIdWithinTileset;
  var tilesPerRow = (targetTileset.sourceImage.width / targetTileset._tileSize.width);
  var row = parseInt(tileId / tilesPerRow);
  var col = (tileId % tilesPerRow);
  var offset = cc.v2(targetTileset._tileSize.width * col, targetTileset._tileSize.height * row);
  var origSize = targetTileset._tileSize;
  var rect = cc.rect(offset.x, offset.y, origSize.width, origSize.height);
  var sf = new cc.SpriteFrame(targetTileset.sourceImage, rect, false /* rotated */ , cc.v2() /* DON'T use `offset` here or you will have an offsetted image from the `cc.Sprite.node.anchor`. */, origSize);
  const data = {
    origSize: targetTileset._tileSize,
    spriteFrame: sf,
  }
  window.gidSpriteFrameMap[gid] = data;
  return data;
}

window.gidAnimationClipMap = {};
window.getOrCreateAnimationClipForGid = function(gid, tiledMapInfo, tilesElListUnderTilesets) {
  if (null != gidAnimationClipMap[gid]) return gidAnimationClipMap[gid];   
  if (false == gidAnimationClipMap[gid]) return null;

  var tilesets = tiledMapInfo.getTilesets();
  var targetTileset = null;
  for (var i = 0; i < tilesets.length; ++i) {
    // TODO: Optimize by binary search.
    if (gid < tilesets[i].firstGid) continue;
    if (i < tilesets.length - 1) {
      if (gid >= tilesets[i + 1].firstGid) continue;
    }
    targetTileset = tilesets[i];
    break;
  }
  if (!targetTileset) return null;
  var tileIdWithinTileset = (gid - targetTileset.firstGid); 
  var tilesElListUnderCurrentTileset = tilesElListUnderTilesets[targetTileset.name + ".tsx"]; 

  var targetTileEl = null;
  for (var tileIdx = 0; tileIdx < tilesElListUnderCurrentTileset.length; ++tileIdx) {
    var tmpTileEl = tilesElListUnderCurrentTileset[tileIdx]; 
    if (tileIdWithinTileset != parseInt(tmpTileEl.id)) continue;
    targetTileEl = tmpTileEl;
    break;
  }

  if (!targetTileEl) return null;
  var animElList = targetTileEl.getElementsByTagName("animation"); 
  if (!animElList || 0 >= animElList.length) return null;
  var animEl = animElList[0]; 

  var uniformDurationSecondsPerFrame = null;
  var totDurationSeconds = 0; 
  var sfList = [];
  var frameElListUnderAnim = animEl.getElementsByTagName("frame"); 
  var tilesPerRow = (targetTileset.sourceImage.width/targetTileset._tileSize.width);

  for (var k = 0; k < frameElListUnderAnim.length; ++k) {
    var frameEl = frameElListUnderAnim[k];   
    var tileId = parseInt(frameEl.attributes.tileid.value);
    var durationSeconds = frameEl.attributes.duration.value/1000; 
    if (null == uniformDurationSecondsPerFrame) uniformDurationSecondsPerFrame = durationSeconds;
    totDurationSeconds += durationSeconds;
    var row = parseInt(tileId / tilesPerRow);
    var col = (tileId % tilesPerRow);
    var offset = cc.v2(targetTileset._tileSize.width*col, targetTileset._tileSize.height*row);
    var origSize = targetTileset._tileSize;
    var rect = cc.rect(offset.x, offset.y, origSize.width, origSize.height);
    var sf = new cc.SpriteFrame(targetTileset.sourceImage, rect, false /* rotated */, cc.v2(), origSize);
    sfList.push(sf);
  } 
  var sampleRate = 1/uniformDurationSecondsPerFrame; // A.k.a. fps.
  var animClip = cc.AnimationClip.createWithSpriteFrames(sfList, sampleRate);
  // http://docs.cocos.com/creator/api/en/enums/WrapMode.html.
  animClip.wrapMode = cc.WrapMode.Loop;
  return {
    origSize: targetTileset._tileSize,
    animationClip: animClip,
  };
};

// Node.js, this is a workaround to avoid accessing the non-existent "TextDecoder class" from "jsexport.js".
window.fs = function() {};
