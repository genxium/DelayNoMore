/****************************************************************************
 Copyright (c) 2017 Chukong Technologies Inc.

 http://www.cocos.com

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated engine source code (the "Software"), a limited,
  worldwide, royalty-free, non-assignable, revocable and  non-exclusive license
 to use Cocos Creator solely to develop games on your target platforms. You shall
  not use Cocos Creator software for developing other software or tools that's
  used for developing games. You are not granted to publish, distribute,
  sublicense, and/or sell copies of Cocos Creator.

 The software or tools in this License Agreement are licensed, not sold.
 Chukong Aipu reserves all rights not expressly granted to you.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 ****************************************************************************/
var ID = 'WXDownloader';
const wxFsUtils = require('./wx-fs-utils');

const REGEX = /^\w+:\/\/.*/;

var packageFiles = null;
var cachedFiles = null;
var writeCacheFileList = null;
var cacheQueue = null;
var checkNextPeriod = false;
var errTest = /the maximum size of the file storage/;

var _newAssets = {};
var WXDownloader = window.WXDownloader = function () {
    this.id = ID;
    this.async = true;
    this.pipeline = null;
    this.REMOTE_SERVER_ROOT = '';
    this.SUBCONTEXT_ROOT = '';

    this.totalBytesExpectedToWriteAlreadyCounted = new Map(); // Keyed by "remoteUrl".
    this.totalBytesExpectedToWriteForAllTasks = 0;
    this.totalBytesWrittenForAllTasks = 0;

    this.immediateHandleItemCount = 0;
    this.immediateHandleItemCompleteCount = 0;

    this.immediateReadFromLocalCount = 0;
    this.immediateReadFromLocalCompleteCount = 0;

    this.immediatePackDownloaderCount = 0;
    this.immediatePackDownloaderCompleteCount = 0;
};
WXDownloader.ID = ID;

WXDownloader.prototype.init = function () {
    if (!CC_WECHATGAMESUB) {
        this.cacheDir = wx.env.USER_DATA_PATH + '/gamecaches';
        this.cachedFileName = 'cacheList.json';
        // whether or not cache asset into user's storage space
        this.cacheAsset = true;
        // cache one per cycle
        this.cachePeriod = 100;
        // whether or not storage space is run out of
        this.outOfStorage = false;

        this.writeFilePeriod = 1000;

        cacheQueue = {};
        packageFiles = {};

        var cacheFilePath = this.cacheDir + '/' + this.cachedFileName;
        cachedFiles = wxFsUtils.readJsonSync(cacheFilePath);
        if (cachedFiles instanceof Error) {
            cachedFiles = {};
            wxFsUtils.makeDirSync(this.cacheDir, true);
            wxFsUtils.writeFileSync(cacheFilePath, JSON.stringify(cachedFiles), 'utf8');
        }
    }
};

WXDownloader.prototype.handle = function (item, callback) {
    if (item.type === 'js') {
        return null;
    }
    var immediateHandleItemCompleteCallback = (errors, results) => {
      wxDownloader.immediateHandleItemCompleteCount += 1;
      callback(errors, results);
    };
    var immediateReadFromLocalCompleteCallback = (errors, results) => {
      wxDownloader.immediateReadFromLocalCompleteCount += 1;
      callback(errors, results);
    };
    var immediatePackerDownloaderCompleteCallback = (errors, results) => {
      wxDownloader.immediatePackDownloaderCompleteCount += 1;
      callback(errors, results);
    };
    if (item.type === 'uuid') {
      wxDownloader.immediatePackDownloaderCount += 1;
      var result = cc.Pipeline.Downloader.PackDownloader.load(item, immediatePackerDownloaderCompleteCallback);
        if (undefined === result) {
          // When "undefined" is returned, the above "PackDownloader.load(...)" has finished running synchronously and won't trigger "theWrappedCompleteCallback".
          wxDownloader.immediatePackDownloaderCompleteCount += 1;
          return;
        } else if (null === result) {
          // When "null" is returned, the above "PackDownloader.load(...)" has been running asynchronously and will trigger "theWrappedCompleteCallback".
          return;
        } else {
          // When "non-empty" is returned, the above "PackDownloader.load(...)" has finished running synchronously and won't trigger "theWrappedCompleteCallback".
          wxDownloader.immediatePackDownloaderCompleteCount += 1;
          return result;
        }
    }

    if (CC_WECHATGAMESUB) {
        // if wx.getFileSystemManager is undefined, need to skip
        if (REGEX.test(item.url)) {
            return null;
        }

        item.url = this.SUBCONTEXT_ROOT + '/' + item.url;
        if (wxFsUtils.checkFsValid()) return null;
        wxDownloader.immediateHandleItemCount += 1;

        handleItem(item, immediateHandleItemCompleteCallback);
        return;
    }

    function seek (inPackage) {
        if (inPackage) {
          wxDownloader.immediateHandleItemCount += 1;
          handleItem(item, immediateHandleItemCompleteCallback);
        }
        else {
          wxDownloader.immediateReadFromLocalCount += 1;
          readFromLocal(item, immediateReadFromLocalCompleteCallback);
        }
    }

    if (item.url in packageFiles) {
        seek(packageFiles[item.url]);
    }
    else {
        wxFsUtils.exists(item.url, function (existance) {
            packageFiles[item.url] = existance;
            seek(existance);
        });
    }
};

WXDownloader.prototype.cleanOldAssets = function () {
    cc.warn('wxDownloader.cleanOldAssets has been deprecated, please use wxDownloader.cleanOldCaches instead!');
    return this.cleanOldCaches();
};

WXDownloader.prototype.cleanOldCaches = function () {
    this.cleanAllCaches(_newAssets, function (err) {
        if (err) {
            cc.warn(err);
        }
        else {
            for (var path in _newAssets) {
                cc.log('reserve local file: ' + path);
            }
            cc.log('Clean old Assets successfully!');
        }
    });
};

function handleItem (item, callback) {
    if (item.type && !shouldReadFile(item.type)) {
        callback(null, null);
    }
    else {
        readFile(item, callback);
    }
}

WXDownloader.prototype.getCacheName = function (filePath) {
    var cacheUrlReg = /\//g;
    return filePath.replace(cacheUrlReg, '-');
};

WXDownloader.prototype.getCachedFileList = function () {
    return cachedFiles;
};

WXDownloader.prototype.cleanCache = function (filePath) {
    if (filePath in cachedFiles) {
        var self = this;
        delete cachedFiles[filePath];
        wxFsUtils.writeFileSync(this.cacheDir + '/' + this.cachedFileName, JSON.stringify(cachedFiles), 'utf8');
        wxFsUtils.deleteFile(this.cacheDir + '/' + filePath, function (err) {
            if (!err) self.outOfStorage = false;
        });
    }
};

WXDownloader.prototype.cleanAllAssets = function () {
    cc.warn('wxDownloader.cleanAllAssets has been deprecated, please use cleanAllCaches instead!');
    this.cleanAllCaches(null, function (err) {
        if (err) cc.error(err.message);
    });
};

WXDownloader.prototype.cleanAllCaches = function (exclude, callback) {
    exclude = exclude || {};
    var self = this;
    var result = wxFsUtils.readDir(self.cacheDir, function (err, list) {
        if (err) {
            callback && callback(err);
            return;
        }
        var toDelete = [];
        for (var i = 0, l = list.length; i < l; i ++) {
            var path = list[i];
            if (path === self.cachedFileName) continue;
            if (path in exclude) continue;
            if (path in cacheQueue) {
                delete cacheQueue[path];
                continue;
            }
            delete cachedFiles[path];
            toDelete.push(path);
        }
        wxFsUtils.writeFileSync(self.cacheDir + '/' + self.cachedFileName, JSON.stringify(cachedFiles), 'utf8');
        var count = 0;
        for (var i = 0, l = toDelete.length; i < l; i ++) {
            wxFsUtils.deleteFile(self.cacheDir + '/' + toDelete[i], function (err) {
                if (!err) self.outOfStorage = false;
                count++;
                if (count === l) callback && callback(null);
            })
        }
    });
    if (result) callback(result);
};

var wxDownloader = window.wxDownloader = new WXDownloader();

function registerFailHandler (item, cachePath) {
    var queue = cc.LoadingItems.getQueue(item);
    queue.addListener(item.id, function (item) {
        if (item.error) {
            if (item.url in cacheQueue) {
                delete cacheQueue[item.url];
            }
            else {
                wxDownloader.cleanCache(cachePath);
            }
        }
    });
}

function readFile (item, callback) {
    var url = item.url;
    var func = wxFsUtils.readText;
    if (getFileType(item.type) === FileType.BIN) func = wxFsUtils.readArrayBuffer;
    var result = func(url, function (err, data) {
        if (err) {
            callback(err);
            return;
        }
        if (data) {
            item.states[cc.loader.downloader.id] = cc.Pipeline.ItemState.COMPLETE;
            callback(null, data);
        }
        else {
            callback(new Error("Empty file: " + url));
        }
    });
    if (result) callback(result);
}

function readFromLocal (item, callback) {
    var result = wxFsUtils.checkFsValid();
    if (result) {
        callback(result);
        return;
    }

    var cachedPath = wxDownloader.getCacheName(item.url);
    var localPath = wxDownloader.cacheDir + '/' + cachedPath;

    if (cachedPath in cachedFiles) {
        // cache new asset
        _newAssets[cachedPath] = true;
        item.url = localPath;
        registerFailHandler(item, cachedPath);
        handleItem(item, callback);
    }
    else {
        if (!wxDownloader.REMOTE_SERVER_ROOT) {
            callback(null, null);
            return;
        }

        downloadRemoteFile(item, callback);
    }
}

function cacheFile (url, isCopy, cachePath) {
    cacheQueue[url] = { isCopy, cachePath };

    if (!checkNextPeriod) {
        checkNextPeriod = true;
        function cache () {
            checkNextPeriod = false;
            for (var srcUrl in cacheQueue) {
                if (!wxDownloader.outOfStorage) {
                    var item = cacheQueue[srcUrl]
                    var localPath = wxDownloader.cacheDir + '/' + item.cachePath;
                    var func = wxFsUtils.copyFile;
                    if (!item.isCopy) func = wxFsUtils.downloadFile; 
                    func(srcUrl, localPath, function (err) {
                        if (err)  {
                            errTest.test(err.message) && (wxDownloader.outOfStorage = true);
                            return;
                        }
                        cachedFiles[item.cachePath] = 1;
                        writeCacheFile();
                    });
                    delete cacheQueue[srcUrl];
                }
                if (!cc.js.isEmptyObject(cacheQueue) && !checkNextPeriod) {
                    checkNextPeriod = true;
                    setTimeout(cache, wxDownloader.cachePeriod);
                }
                return;
            }
        };
        setTimeout(cache, wxDownloader.cachePeriod);
    }
}

function downloadRemoteFile (item, callback) {
    // Download from remote server
    var relatUrl = item.url;

    // filter protocol url (E.g: https:// or http:// or ftp://)
    if (REGEX.test(relatUrl)) {
        callback(null, null);
        return;
    }

    var remoteUrl = wxDownloader.REMOTE_SERVER_ROOT + '/' + relatUrl;
    item.url = remoteUrl;
    var cachePath = wxDownloader.getCacheName(relatUrl);
    if (cc.sys.os === cc.sys.OS_ANDROID && item.type && getFileType(item.type) === FileType.IMAGE) {
        if (wxDownloader.cacheAsset) {
            cacheFile(remoteUrl, false, cachePath);
            registerFailHandler(item, cachePath);
        }
        callback(null, null);
    }
    else {
        wxFsUtils.downloadFile(remoteUrl, undefined, function (err, path) {
            if (err) {
                callback(err, null);
                return;
            }
            item.url = path;
            if (wxDownloader.cacheAsset) {
                cacheFile(path, true, cachePath);
                registerFailHandler(item, cachePath);
            }
            handleItem(item, callback);
        });
    }
    
}

function writeCacheFile () {
    function write () {
        writeCacheFileList = null; 
        wxFsUtils.writeFile(wxDownloader.cacheDir + '/' + wxDownloader.cachedFileName, JSON.stringify(cachedFiles), 'utf8');
    }
    !writeCacheFileList && (writeCacheFileList = setTimeout(write, wxDownloader.writeFilePeriod));
}

function shouldReadFile (type) {
    return getFileType(type) >= FileType.LOADABLE_MIN;
}

function getFileType (type) {
    return (map[type] || FileType.DEFAULT);
}

var FileType = {
    'IMAGE': 1,
    'FONT': 2,
    'AUDIO': 3,
    'SCRIPT': 4,
    'TEXT': 5,
    'BIN': 6,
    'DEFAULT': 7,
    'LOADABLE_MIN': 5
};

var map = {
    // JS
    'js' : FileType.SCRIPT,

    // Images
    'png' : FileType.IMAGE,
    'jpg' : FileType.IMAGE,
    'bmp' : FileType.IMAGE,
    'jpeg' : FileType.IMAGE,
    'gif' : FileType.IMAGE,
    'ico' : FileType.IMAGE,
    'tiff' : FileType.IMAGE,
    'webp' : FileType.IMAGE,
    'image' : FileType.IMAGE,

    // Audio
    'mp3' : FileType.AUDIO,
    'ogg' : FileType.AUDIO,
    'wav' : FileType.AUDIO,
    'm4a' : FileType.AUDIO,

    // Txt
    'txt' : FileType.TEXT,
    'xml' : FileType.TEXT,
    'vsh' : FileType.TEXT,
    'fsh' : FileType.TEXT,
    'atlas' : FileType.TEXT,

    'tmx' : FileType.TEXT,
    'tsx' : FileType.TEXT,

    'json' : FileType.TEXT,
    'ExportJson' : FileType.TEXT,
    'plist' : FileType.TEXT,

    'fnt' : FileType.TEXT,

    // Font
    'font' : FileType.FONT,
    'eot' : FileType.FONT,
    'ttf' : FileType.FONT,
    'woff' : FileType.FONT,
    'svg' : FileType.FONT,
    'ttc' : FileType.FONT,

    // Binary
    'binary' : FileType.BIN,
    'dbbin' : FileType.BIN,
    'bin': FileType.BIN,
    'pvr': FileType.BIN,
    'pkm': FileType.BIN
};
// function downloadRemoteTextFile (item, callback) {
//     // Download from remote server
//     var relatUrl = item.url;
//     var remoteUrl = wxDownloader.REMOTE_SERVER_ROOT + '/' + relatUrl;
//     item.url = remoteUrl;
//     wx.request({
//         url: remoteUrl,
//         success: function(res) {
//             if (res.data) {
//                 if (res.statusCode === 200 || res.statusCode === 0) {
//                     var data = res.data;
//                     item.states[cc.loader.downloader.ID] = cc.Pipeline.ItemState.COMPLETE;
//                     if (data) {
//                         if (typeof data !== 'string' && !(data instanceof ArrayBuffer)) {
//                             // Should we check if item.type is json ? If not, loader behavior could be different
//                             item.states[cc.loader.loader.ID] = cc.Pipeline.ItemState.COMPLETE;
//                             callback(null, data);
//                             data = JSON.stringify(data);
//                         }
//                         else {
//                             callback(null, data);
//                         }
//                     }

//                     // Save to local path
//                     var localPath = wx.env.USER_DATA_PATH + '/' + relatUrl;
//                     // Should recursively mkdir first
//                     fs.writeFile({
//                         filePath: localPath,
//                         data: data,
//                         encoding: 'utf8',
//                         success: function (res) {
//                             cc.log('Write file to ' + res.savedFilePath + ' successfully!');
//                         },
//                         fail: function (res) {
//                             // undone implementation
//                         }
//                     });
//                 } else {
//                     cc.warn("Download text file failed: " + remoteUrl);
//                     callback({
//                         status:0, 
//                         errorMessage: res && res.errMsg ? res.errMsg : "Download text file failed: " + remoteUrl
//                     });
//                 }
//             }
//         },
//         fail: function (res) {
//             // Continue to try download with downloader, most probably will also fail
//             callback(null, null);
//         }
//     });
// }
