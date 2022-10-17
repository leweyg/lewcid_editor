import * as THREE from 'three';

import { AddObjectCommand } from './commands/AddObjectCommand.js';
import { Viewport } from './Viewport.js';

var FolderUtils = {

    ShellExecute : function (cmd,callback,cd="./") {
        if (!FolderUtils.IsLocalHost()) {
            alert("Not supported on web!");
            if (callback) callback(null);
            return;
        }
        var encoded = cmd.replace(" ","_");
        FolderUtils.DownloadText("php/shell_execute.php?cd=" + cd + "&cmd=" + encoded, callback);
    },

    EditorRefresh : function() {
        if (editor && editor.viewport && editor.viewport.render) {
            editor.viewport.render();
        }
    },

    IsLocalHost : function() {
        return window.location.href.includes("localhost:");
    },

    __CachedFileTree : null,
    GetFilesInFileTreeRecursive : function(path,fileTree) {
        if (path.startsWith("../")) {
            // assume from the editor direction:
            path = path.substring( "../".length );
        }
        if (path == "") {
            var ans = [];
            for (var k in fileTree) {
                ans.push(k);
            }
            return ans;
        }
        while (path.includes("/")) {
            var ndx = path.indexOf("/");
            var left = path.substring(0,ndx+1);
            var right = path.substring(ndx+1);
            if (left in fileTree) {
                var subTree = fileTree[left];
                return FolderUtils.GetFilesInFileTreeRecursive(right, subTree);
            }
            return FolderUtils.GetFilesInFileTreeRecursive("", subTree);
        }
    },
    GetFilesInPath : function(path,callback) {
        if (FolderUtils.IsLocalHost()) {
            FolderUtils.ShellExecute("ls -1 -p",(file_list) => {
                var files = file_list.split("\n");
                return callback(files);
            }, path);
        } else {
            if (!FolderUtils.__CachedFileTree) {
                var hackForNowPath = "../file_tree.json";
                FolderUtils.DownloadJSON(hackForNowPath, (fileTree)=>{
                    if (!("editor/" in fileTree)) {
                        fileTree["editor/"] = {};
                    }
                    FolderUtils.__CachedFileTree = fileTree;
                    callback( FolderUtils.GetFilesInFileTreeRecursive(path, fileTree) );
                });
            } else {
                callback( FolderUtils.GetFilesInFileTreeRecursive(path, FolderUtils.__CachedFileTree) );
            }
        }
    },


    BuildFileListLocal : function(path, callback) {
        FolderUtils.GetFilesInPath(path, (list) => {
            var ans = {};
            var waiting = 0;
            var checkDone = (() => {
                if (waiting == 0) {
                    callback(ans);
                }
            });
            for (var index in list) {
                var file = list[index];
                if (file.trim() == "") continue;
                if (file.endsWith("/")) {
                    ans[file] = {};
                    waiting++;
                    function buildSub(_path, _file, _into) {
                        var full = _path + _file;
                        FolderUtils.BuildFileListLocal(full, (subList) => {
                            _into[_file] = subList;
                            waiting--;
                            checkDone();
                        });
                    }
                    buildSub( path, file, ans );

                } else {
                    ans[file] = 0;
                }
            }
            checkDone();
        });
    },

    GetFilePathInURL : function() {
		var queryString = window.location.search;
		var urlParams = new URLSearchParams(queryString);
		var file_path = urlParams.get("file_path");
		if (!file_path) return;
        if (!FolderUtils.IsLocalHost()) {
            if (file_path.startsWith("../../")) {
                // not needed on web:
                file_path = file_path.substring("../".length);
            }
        }
        return file_path;
    },

    SetFilePathInURL : function(path) {
        var current = window.location.pathname;
        var toUrl = current + "?file_path=" + path;
        var name = FolderUtils.PathWithoutFolder(path);
        window.history.pushState({},name,toUrl);
    },

    SetTitleFromPath : function(path) {
        document.title = FolderUtils.PathWithoutFolder(path) + " - lewcid editor";
    },

    PathParentFolder : function(path) {
        if (path.endsWith("/")) {
            path = path.substring(0,path.length-1);
            var ending = path.lastIndexOf("/");
            if (ending > 0) {
                path = path.substring(0,ending+1);
                return path;
            }
        }
        if (path.includes("/")) {
            var ending = path.lastIndexOf("/");
            return path.substring(0,ending+1);
        }
        console.error("TODO");
        return path;
    },

    PathWithoutFolder : function(path) {
        if (path.includes("/")) {
            var ending = path.lastIndexOf("/");
            return path.substring(ending+1);
        }
        return path;
    },

    PathDisplayName : function(path) {
        path = FolderUtils.PathWithoutFolder(path);
        if (path.includes(".")) {
            path = path.substring(0,path.lastIndexOf("."));
        }
        return path;
    },

    SetDefaultScene : function(editor) {
        editor.clear();
        FolderUtils.AddDefaultLight(editor);
    },

    ImportByPath_OBJ : async function(path,callback_blob,noAutoEditorAdd=false) {
        if (path.endsWith(".obj")) {
            const { MTLLoader } = await import( 'three/addons/loaders/MTLLoader.js' );
			const { OBJLoader } = await import( 'three/addons/loaders/OBJLoader.js' );

            function loadObjWithMaterials(materials) {
                var loader = new OBJLoader();
                if (materials) loader.setMaterials(materials);
                loader.load(path, function (object) {
                    object.name = FolderUtils.PathDisplayName(path);
                    object.userData = {
                        source : FolderUtils.PathWithoutFolder(path)
                    };
                    var isAutoAdd = !noAutoEditorAdd;
                    if (isAutoAdd) {
                        FolderUtils.EnsureMainSceneNode(editor,(parent)=>{
                            parent.add(object);
                        });
                        if (editor.selected) {
                            object.position.copy(editor.selected.position);
                            object.rotation.copy(editor.selected.rotation);
                            object.scale.copy(editor.selected.scale);
                        }
                        editor.selected = object;
                        editor.signals.objectSelected.dispatch( object );
                    } else {
                        FolderUtils.EditorRefresh();
                    }
                    if (callback_blob) callback_blob(object);
                });
            }

            var mtlPath = path.replace(".obj",".mtl");
            new MTLLoader()
                .load(mtlPath, function (materials) {
                    materials.preload();
                    loadObjWithMaterials(materials);
                }, () => {},
                (errorInfo) => {
                    loadObjWithMaterials(null);
                });
            return;
        }
    },


    ImportByPath_MTL : async function(path,callback_blob,noAutoEditorAdd=false) {
        const { MTLLoader } = await import( 'three/addons/loaders/MTLLoader.js' );

        var mtlPath = path.replace(".obj",".mtl");
        new MTLLoader()
            .load(mtlPath, function (materials) {
                materials.preload();
                var group = new THREE.Group();
                group.name = FolderUtils.PathWithoutFolder(path);
                var matList = materials.materials;
                
                var matOffset = 0;
                for (var matIndex in matList) {
                    var material = matList[matIndex];
                    const geometry = new THREE.SphereGeometry( 0.5, 8, 8 );
                    const sphere = new THREE.Mesh( geometry, material );
                    sphere.position.set( matOffset, 0, 0 );
                    matOffset += 1.0;
                    sphere.name = matIndex;
                    group.add(sphere);
                }

                editor.execute( new AddObjectCommand( editor, group ) );
                if (callback_blob) callback_blob(group);
            });
    },

    lewcidObject_CleanUserData : function(obj) {
        var ans = {};
        if (obj.userData) {
            for (var prop in obj.userData) {
                ans[prop] = obj.userData[prop];
            }
        }
        var toInclude = ["source"];
        for (var i in toInclude) {
            var prop = toInclude[i];
            if (prop in obj) {
                ans[prop] = obj[prop];
            }
        }
        /*  
        var toExclude = {
            "children":0,
            "position":0,
            "rotation":0,
            "rotation_degrees":0};
        for (var prop in obj) {
            if (prop in toExclude) continue;
            ans[prop] = obj[prop];
        }
        */
        return ans;
    },

    lewcidObject_ApplyTransformToScene : function(el,jsonObj) {
        if (jsonObj.position) {
            var p = jsonObj.position;
            el.position.set(p[0],p[1],p[2]);
        }
        if (jsonObj.rotation) {
            var p = jsonObj.rotation;
            el.rotation.set(p[0],p[1],p[2]);
        }
        if (jsonObj.scale) {
            var p = jsonObj.scale;
            el.scale.set(p[0],p[1],p[2]);
        }
        if (jsonObj.rotation_degrees) {
            var p = jsonObj.rotation_degrees;
            var s = 3.14159 / 180.0;
            el.rotation.set(p[0]*s,p[1]*s,p[2]*s);
        }
    },

    lewcidObject_sceneFromJsonObject : function(jsonObj,folderPath) {
        var el = new THREE.Group();
        el.userData = FolderUtils.lewcidObject_CleanUserData( jsonObj );
        if (jsonObj.name) {
            el.name = jsonObj.name;
        }
        FolderUtils.lewcidObject_ApplyTransformToScene(el, jsonObj);
        if (jsonObj.source) {
            var url = folderPath + jsonObj.source;
            FolderUtils.ImportByPath_OBJ(url, (childObj) => {
                if (!childObj.name) childObj.name = FolderUtils.PathDisplayName(jsonObj.source);
                el.add(childObj);
            }, /*noAutoEditorAdd=*/true );
        }
        if (jsonObj.children) {
            for (var childIndex in jsonObj.children) {
                var child = jsonObj.children[childIndex];
                var res = FolderUtils.lewcidObject_sceneFromJsonObject(child,folderPath);
                if (!res.name) {
                    res.name = "child" + childIndex;
                }
                el.add(res);
            }
        }
        return el;
    },

    lewcidObject_CleanUserDataForExport : function(data) {
        var ans = {};
        var toExclude = {"source":true,};
        for (var prop in data) {
            if (prop in toExclude) continue;
            ans[prop] = data[prop];
        }
        return ans;
    },

    lewcidObject_ExportTransformFrom : function(ans,scene) {
        const posZero = new THREE.Vector3();
        if (scene.position && !scene.position.equals(posZero)) {
            var v = scene.position;
            ans.position = [ v.x, v.y, v.z ];
        }
        const eulerZero = new THREE.Euler();
        if (scene.rotation && !scene.rotation.equals(eulerZero)) {
            var v = scene.rotation;
            ans.rotation = [ v.x, v.y, v.z ];
        }
        const scaleOne = new THREE.Vector3(1,1,1);
        if (scene.scale && !scene.scale.equals(scaleOne)) {
            var v = scene.scale;
            ans.scale = [ v.x, v.y, v.z ];
        }
    },

    lewcidObject_ExportToObjectFromSceneRecursive : function(scene) {
        var ans = {};
        
        if (scene.name) {
            ans.name = scene.name;
        }
        FolderUtils.lewcidObject_ExportTransformFrom(ans, scene);
        if (scene.userData) {
            ans.userData = FolderUtils.lewcidObject_CleanUserDataForExport( scene.userData );
        }
        if (scene.userData && scene.userData.source) {
            ans.source = scene.userData.source;
        } else if (scene.children && scene.children.length>0) {
            ans.children = [];
            for (var i in scene.children) {
                var from = scene.children[i];
                var to = FolderUtils.lewcidObject_ExportToObjectFromSceneRecursive(from);
                ans.children.push(to);
            }
        }
        return ans;
    },

    lewcidObject_ExportToObjectFromEditor : function() {
        var toExport = FolderUtils.EnsureMainSceneNode(editor);
        var root = FolderUtils.lewcidObject_ExportToObjectFromSceneRecursive(toExport);
        root.metadata = {
            "version": 0.2,
            "type": "lewcid_object"
        };
        if (editor.camera) {
            var cam = {};
            root.metadata.camera = cam;
            FolderUtils.lewcidObject_ExportTransformFrom(cam, editor.camera);
        }
        return root;
    },

    ImportByPath_lewcidJSON : async function(path,callback_blob) {
        FolderUtils.DownloadJSON(path, (jsonObject) => {
            var folderRoot = FolderUtils.PathParentFolder(path);
            if (!jsonObject.name) {
                jsonObject.name = FolderUtils.PathWithoutFolder(path);
            }
            var sceneObject = FolderUtils.lewcidObject_sceneFromJsonObject(jsonObject,folderRoot);

            editor.execute( new AddObjectCommand( editor, sceneObject ) );
            if (jsonObject.metadata && jsonObject.metadata.camera) {
                FolderUtils.lewcidObject_ApplyTransformToScene(editor.camera, jsonObject.metadata.camera);
            }

            if (callback_blob) callback_blob(sceneObject);
        });

    },

    ImportByPath : async function(path,callback_blob) {
        if (path.endsWith(".obj")) {
            return await FolderUtils.ImportByPath_OBJ(path, callback_blob);
        }
        if (path.endsWith(".mtl")) {
            return await FolderUtils.ImportByPath_MTL(path, callback_blob);
        }
        if (path.endsWith(".json") || path.endsWith(".path_scene")) {
            return FolderUtils.ImportByPath_lewcidJSON(path,callback_blob);
        }
        FolderUtils.DownloadBlob(path, (blob) => {
            blob.name = path;
            if (callback_blob) callback_blob(blob);
            editor.loader.loadFile( blob );
        });
    },

    AddDefaultLight : function(editor) {
        const color = 0xffffff;
        const intensity = 1;

        const light = new THREE.DirectionalLight( color, intensity );
        light.name = 'DefaultLight';
        light.target.name = 'DirectionalLight Target';

        light.position.set( 5, 10, 7.5 );

        editor.execute( new AddObjectCommand( editor, light ) );
    },

    LoadByPath : async function(path, callback) {
        // generic: editor.loader.loadFile( blob );

        const { OBJLoader } = await import( 'three/addons/loaders/OBJLoader.js' );
        const loader = new OBJLoader();
        var internalCallback = (val,error) => {
            if (!val) {
                console.log("Error loading '" + path, + "': " + error);
                return;
            }
            editor.execute( new AddObjectCommand( editor, val ) );
            callback(val,error);
        };
        loader.load(path, 
            (loaded) => { internalCallback(loaded); },
            (progress) => { },
            (error) => { internalCallback(null,error); } );

        
    },

    DownloadBlob : function(path,callback) {
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/json");
        rawFile.open("GET", path, true);
        rawFile.responseType = 'blob';
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status == "200") {
                callback(rawFile.response);
            }
        }
        rawFile.send(null);
    },

    CreateMainSceneNode : function(callback) {
        var gp = new THREE.Group();
        gp.name = "MainScene";
        if (callback) callback(gp);
        editor.execute( new AddObjectCommand( editor, gp ) );
        return gp;
    },

    FindMainSceneNode : function() {
        var top = editor.scene;
        for (var ndx in top.children) {
            var child = top.children[ndx];
            if (child.name == "DefaultLight") continue;
            if (child.name == "DefaultLight2") continue;
            return child;
        }
        return undefined;
    },

    EnsureMainSceneNode : function(editor,callback) {
        var top = FolderUtils.FindMainSceneNode();
        if (top) {
            if (callback) callback(top);
            return top;
        }
        return FolderUtils.CreateMainSceneNode(callback);
    },

    ShellSaveToFile : function(path,content,callback) {
        var url = "php/save_to_file.php?path=" + path;
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/json");
        rawFile.open("POST", url, true);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status == "200") {
                callback(rawFile.responseText);
            }
        }
        rawFile.send(content);
    },

    DownloadText : function (path, callback) {
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/json");
        rawFile.open("GET", path, true);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status == "200") {
                callback(rawFile.responseText);
            }
        }
        rawFile.send(null);
    },

    DownloadJSON : function(file, callback) {
        FolderUtils.DownloadText(file, (txt) => {
            var obj = JSON.parse(txt);
            callback(obj);
        });
    },

    ThreadStart : function() {
    },
    ThreadDone : function() {
    },

};

export { FolderUtils };
