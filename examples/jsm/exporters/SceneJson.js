
import * as THREE from 'three';
import { StreamUtils } from './StreamUtils.js'

// Scene is a three.js Group of nodes,
//  "obj" is a JSON compatible object
var SceneJson = {
    objFromScene : function(sceneEl) {
        return SceneJson._objFromSceneRecursive(sceneEl);
    },
    sceneUpdateFromObj : function(sceneParent,jsonObj,folderPath) {
        return SceneJson._importSceneFromObj(sceneParent,jsonObj,folderPath);
    },
    _exportDist : 0.001, // export data resolution
    _exportArrays : true,
    sceneFromPathAsync : async function(path,parentScene,callback_blob) {
        console.assert(parentScene);
        StreamUtils.downloadJSON(path, (jsonObject) => {
            if (!jsonObject) {
                if (callback_blob) callback_blob(null);
                return;
            }
            var folderRoot = StreamUtils.pathParentFolder(path);
            if (!jsonObject.name) {
                jsonObject.name = StreamUtils.pathWithoutFolder(path);
            }
            var sceneObject = SceneJson.sceneFromObj(jsonObject,folderRoot);

            parentScene.add(sceneObject);

            if (callback_blob) callback_blob(sceneObject);
        });

    },

    // Internal methods:s
    _objFromSceneRecursive : function(scene) {
        var ans = {};
        
        if (scene.name) {
            ans.name = scene.name;
        }
        this.transformExportSceneToObj(scene, ans);

        if (scene.userData && scene.userData.source) {
            ans.source = scene.userData.source;
        } else if (scene.children && scene.children.length>0) {
            ans.children = [];
            for (var i in scene.children) {
                var from = scene.children[i];
                var to = this._objFromSceneRecursive(from);
                ans.children.push(to);
            }
        }
        return ans;
    },
    _cleanNumber : function(v) {
        var scl = 1.0 / this._exportDist;
        return (Math.round(v * scl) / scl);
    },
    _cleanNumberArray : function(ar) {
        for (var i in ar) {
            ar[i] = this._cleanNumber(ar[i]);
        }
        return ar;
    },
    _vec3t1 : new THREE.Vector3(),
    vec3Near : function(a,b) {
        var t = this._vec3t1;
        t.copy(a);
        t.sub(b);
        var d = t.length();
        return (d < this._exportDist);
    },
    vec3Export : function(vec) {
        if (this._exportArrays) {
            return this._cleanNumberArray(
                [vec.x, vec.y, vec.z]);
        }

        return {
            x : this._cleanNumber(vec.x),
            y : this._cleanNumber(vec.y),
            z : this._cleanNumber(vec.z)
        };
    },
    vec3Import : function(vec, into) {
        if (Array.isArray(vec)) {
            if (into) {
                into.set(vec[0], vec[1], vec[2]);
                return into;
            } else {
                return new THREE.Vector3(vec[0], vec[1], vec[2]);
            }
        }
        if (into) {
            into.set(vec.x, vec.y, vec.z);
            return into;
        } else {
            return new THREE.Vector3(vec.x, vec.y, vec.z);
        }
    },
    eulerExport : function(vec) {
        if (this._exportArrays) {
            return this._cleanNumberArray(
                [vec.x, vec.y, vec.z]);
        }
        return {
            x : this._cleanNumber(vec.x),
            y : this._cleanNumber(vec.y),
            z : this._cleanNumber(vec.z)
        };
    },
    eulerImport : function(vec, into) {
        if (Array.isArray(vec)) {
            if (into) {
                into.set(vec[0], vec[1], vec[2]);
                return into;
            } else {
                return new THREE.Euler(vec[0], vec[1], vec[2]);
            }
        }
        if (into) {
            into.set(vec.x, vec.y, vec.z);
            return into;
        } else {
            return new THREE.Euler(vec.x, vec.y, vec.z);
        }
    },

    transformExportSceneToObj : function(scene, into) {
        if (!into) into = {};
        const posZero = new THREE.Vector3();
        if (scene.position && !this.vec3Near(scene.position,posZero)) {
            into.position = this.vec3Export( scene.position );
        }
        const eulerZero = new THREE.Euler();
        if (scene.rotation && !this.vec3Near(scene.rotation,eulerZero)) {
            into.rotation = this.eulerExport( scene.rotation );
        }
        const scaleOne = new THREE.Vector3(1,1,1);
        if (scene.scale && !this.vec3Near(scene.scale,scaleOne)) {
            into.scale = this.vec3Export( scene.scale );
        }
        return into;
    },
    transformImportObjIntoScene : function(jsonObj,into) {
        console.assert(into);
        if (jsonObj.position) {
            this.vec3Import( jsonObj.position, into.p );
        }
        if (jsonObj.rotation) {
            this.eulerImport( jsonObj.rotation, into.rotation );
        }
        if (jsonObj.scale) {
            this.vec3Import( jsonObj.scale, into.scale );
        }
    },

    _importSceneFromObj : function(sceneParent, jsonObj,folderPath) {
        var el = sceneParent ? sceneParent : (new THREE.Group());
        if (jsonObj.userData) {
            el.userData = jsonObj.userData;
        }
        if (jsonObj.name) {
            el.name = jsonObj.name;
        }
        this.transformImportObjIntoScene(jsonObj, el);
        if (jsonObj.source) {
            var url = folderPath + jsonObj.source;
            SceneJson.sceneFromPathAsync(url, el, (childObj) => {
                // child already in el
            });
        }
        if (jsonObj.children) {
            for (var childIndex in jsonObj.children) {
                var isPatch = (childIndex < el.children.length);
                var into = (isPatch ? el.children[childIndex] : null );
                if (isPatch) {
                    into = (new THREE.Group());
                    el.add(into);
                }

                var childObj = jsonObj.children[childIndex];
                var res = this._importSceneFromObj(into, childObj, folderPath);
                if (!res.name) {
                    res.name = "child" + childIndex;
                }
            }
        }
        return el;
    },
};


export { SceneJson };

