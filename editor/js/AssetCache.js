import * as THREE from 'three';

import { FolderUtils } from './FolderUtils.js';

var AssetCache = {

    mKnownAssetsByPath: { },
    mCleanRoot: new THREE.Group(),

    Load: function(path, callback, parent) {
        var cache = this.EnsureCacher(path);
        var onReady = ((originalObj) => {
            var obj = originalObj ? originalObj.clone() : null;
            if (parent) {
                parent.add(obj);
            }
            if (callback) {
                callback(obj);
            }
        });
        if (cache.ready) {
            onReady(cache.cleanCopy);
            return;
        }
        cache.readyCallbacks.push(onReady);
        if (!(cache.downloading)) {
            cache.downloading = true;
            FolderUtils.ImportByPath(path, (obj)=>{
                cache.cleanCopy = obj;
                cache.downloading = false;
                cache.ready = true;
                for (var i in cache.readyCallbacks) {
                    var cb = cache.readyCallbacks[i];
                    if (cb) {
                        cb(obj);
                    }
                }
            }, AssetCache.mCleanRoot, /*skipCache=*/true);
        }
    },

    CustomClone : function(obj) {

    },

    EnsureCacher: function(path) {
        if (path in this.mKnownAssetsByPath) {
            return this.mKnownAssetsByPath[path];
        }
        var cacher = {
            path : path,
            ready : false,
            downloading : false,
            cleanCopy : null,
            readyCallbacks : [],
            clone : function() {
                console.assert(this.cleanCopy);
                return this.cleanCopy.clone();
            },
        };
        this.mKnownAssetsByPath[path] = cacher;
        return cacher;
    },

};

export { AssetCache };

