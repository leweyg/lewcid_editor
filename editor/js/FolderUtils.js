import * as THREE from 'three';

import { AddObjectCommand } from './commands/AddObjectCommand.js';

var FolderUtils = {

    ShellExecute : function (cmd,callback,cd="./") {
        var encoded = cmd.replace(" ","_");
        FolderUtils.DownloadText("php/shell_execute.php?cd=" + cd + "&cmd=" + encoded, callback);
    },

    SetDefaultScene : function(editor) {
        editor.clear();
        FolderUtils.AddDefaultLight(editor);
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
