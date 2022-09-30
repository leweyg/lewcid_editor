import * as THREE from 'three';

var FolderUtils = {

    ShellExecute : function (cmd,callback,cd="./") {
        var encoded = cmd.replace(" ","_");
        FolderUtils.DownloadText("php/shell_execute.php?cd=" + cd + "&cmd=" + encoded, callback);
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
