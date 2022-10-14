import * as THREE from 'three';

import { AddObjectCommand } from './commands/AddObjectCommand.js';

var FolderUtils = {

    ShellExecute : function (cmd,callback,cd="./") {
        var encoded = cmd.replace(" ","_");
        FolderUtils.DownloadText("php/shell_execute.php?cd=" + cd + "&cmd=" + encoded, callback);
    },

    GetFilePathInURL : function() {
		var queryString = window.location.search;
		var urlParams = new URLSearchParams(queryString);
		var file_path = urlParams.get("file_path");
		if (!file_path) return;
        return file_path;
    },

    SetFilePathInURL : function(path) {
        var current = window.location.pathname;
        var toUrl = current + "?file_path=" + path;
        var name = FolderUtils.PathWithoutFolder(path);
        window.history.pushState({},name,toUrl);
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

    SetDefaultScene : function(editor) {
        editor.clear();
        FolderUtils.AddDefaultLight(editor);
    },

    ImportByPath_OBJ : async function(path,callback_blob,noAutoEditorAdd=false) {
        if (path.endsWith(".obj")) {
            const { MTLLoader } = await import( 'three/addons/loaders/MTLLoader.js' );
			const { OBJLoader } = await import( 'three/addons/loaders/OBJLoader.js' );

            var mtlPath = path.replace(".obj",".mtl");
            new MTLLoader()
                .load(mtlPath, function (materials) {
                    materials.preload();
                    new OBJLoader()
                        .setMaterials(materials)
                        .load(path, function (object) {
                            object.name = FolderUtils.PathWithoutFolder(path);
                            var isAutoAdd = !noAutoEditorAdd;
                            if (isAutoAdd) {
                                editor.execute( new AddObjectCommand( editor, object ) );
                            }
                            if (callback_blob) callback_blob(object);
                        });
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
                    const geometry = new THREE.SphereGeometry( 1.0, 8, 8 );
                    const sphere = new THREE.Mesh( geometry, material );
                    sphere.position.set( matOffset, 0, 0 );
                    matOffset += 2.0;
                    sphere.name = matIndex;
                    group.add(sphere);
                }

                editor.execute( new AddObjectCommand( editor, group ) );
                if (callback_blob) callback_blob(group);
            });
    },

    lewcidObject_sceneFromJsonObject : function(jsonObj,folderPath) {
        var el = new THREE.Group();
        el.userData = jsonObj;
        if (jsonObj.name) {
            el.name = jsonObj.name;
        }
        if (jsonObj.position) {
            var p = jsonObj.position;
            el.position.set(p[0],p[1],p[2]);
        }
        if (jsonObj.rotation) {
            var p = jsonObj.rotation;
            el.rotation.set(p[0],p[1],p[2]);
        }
        if (jsonObj.rotation_degrees) {
            var p = jsonObj.rotation_degrees;
            var s = 3.14159 / 180.0;
            el.rotation.set(p[0]*s,p[1]*s,p[2]*s);
        }
        if (jsonObj.source) {
            var url = folderPath + jsonObj.source;
            FolderUtils.ImportByPath_OBJ(url, (childObj) => {
                childObj.name = FolderUtils.PathWithoutFolder(jsonObj.source);
                el.add(childObj);
            }, /*noAutoEditorAdd=*/true );
        }
        if (jsonObj.children) {
            for (var childIndex in jsonObj.children) {
                var child = jsonObj.children[childIndex];
                if (!child.name) {
                    child.name = "child" + childIndex;
                }
                var res = FolderUtils.lewcidObject_sceneFromJsonObject(child,folderPath);
                el.add(res);
            }
        }
        return el;
    },

    ImportByPath_lewcidJSON : async function(path,callback_blob) {
        const { MTLLoader } = await import( 'three/addons/loaders/MTLLoader.js' );
        const { OBJLoader } = await import( 'three/addons/loaders/OBJLoader.js' );

        FolderUtils.DownloadJSON(path, (jsonObject) => {
            var folderRoot = FolderUtils.PathParentFolder(path);
            if (!jsonObject.name) {
                jsonObject.name = FolderUtils.PathWithoutFolder(path);
            }
            var sceneObject = FolderUtils.lewcidObject_sceneFromJsonObject(jsonObject,folderRoot);

            editor.execute( new AddObjectCommand( editor, sceneObject ) );
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
        if (path.endsWith(".json")) {
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
