
var StreamUtils = {
    downloadJson : function(file, callback) {
        StreamUtils.downloadText(file, (txt) => {
            var obj = JSON.parse(txt);
            callback(obj);
        });
    },
    downloadText : function(file, callback) {
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/json");
        rawFile.open("GET", file, true);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status == "200") {
                callback(rawFile.responseText);
            }
        }
        rawFile.send(null);
    },
    downloadBinary : function(file, callback) {
        var rawFile = new XMLHttpRequest();
        rawFile.overrideMimeType("application/octet-stream");
        rawFile.responseType = "arraybuffer";
        rawFile.open("GET", file, true);
        rawFile.onreadystatechange = function() {
            if (rawFile.readyState === 4 && rawFile.status == "200") {
                callback(rawFile.response);
            }
        }
        rawFile.send(null);
    },
    _removeQuote : "<rmq>",
    customJsonStringify(obj) {
        var str = JSON.stringify(obj, StreamUtils.customJsonReplacer, 2);
        str = StreamUtils.replaceAll(str, "\"" + StreamUtils._removeQuote, "");
        str = StreamUtils.replaceAll(str, StreamUtils._removeQuote + "\"", "");
        return str;
    },
    customJsonReplacer : function(key,value) {
        if (Array.isArray(value)) {
            for (var i in value) {
                if (typeof(value[i])!="number") {
                    return value;
                }
            }
            var res = "";
            for (var i in value) {
                var str = "" + value[i];
                if (str.length < 2) {
                    str = " " + str;
                }
                if (i != 0) res += ",";
                res += str;
            }
            return StreamUtils._removeQuote + "[" + res + "]" + StreamUtils._removeQuote;
        }
        return value;
    },
    replaceAll : function (str, from, to) {
        while (str.includes(from)) {
            str = str.replace(from, to);
        }
        return str;
    },
    parsePath : function(root,path) {
        var parts = path.split(".");
        for (var i in parts) {
            var prop = parts[i];
            var index = null;
            if (prop.endsWith("]")) {
                var mid = prop.indexOf("[");
                index = prop.substring(mid+1).replace("]","");
                prop = prop.substring(0,mid);
            }
            console.assert(prop in root);
            root = root[prop];
            if (index != null) {
                root = root[index];
            }
        }
        return root;
    },
    pathParentFolder : function(path) {
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
    pathWithoutFolder : function(path) {
        if (path.includes("/")) {
            var ending = path.lastIndexOf("/");
            return path.substring(ending+1);
        }
        return path;
    },
    cleanPathToName : function(path) {
        if (path.includes("/")) {
            path = path.substring(path.lastIndexOf("/")+1);
        }
        if (path.includes(".")) {
            path = path.substring(0,path.indexOf("."));
        }
        var ans = "";
        var parts = path.split("_");
        for (var i in parts) {
            var p = parts[i];
            p = p.substring(0,1).toUpperCase() + p.substring(1);
            if (i != 0) {
                ans += " ";
            }
            ans += p;
        }
        return ans;
    },
    cloneDeep : function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    cookieSave : function(game,prefix="app_state") {
        var txt = JSON.stringify(game.state);
        document.cookie = prefix + "=" + txt;
    },
    cookieTryLoad : function(game,prefix="app_state") {
        var parts = document.cookie.split(";");
        prefix = prefix + "=";
        for (var i in parts) {
            var p = parts[i].trim();
            if (p.startsWith(prefix)) {
                p = p.replace(prefix,"");
                var obj = JSON.parse(p);
                game.loadStateExternal(obj);
                return;
            }
        }
        return false;
    },
    cleanPathForId : function(path) {
        return path.replace(".","_").replace("[","_").replace("]","_");
    },
    lerp : function(a,b,t) {
        return ((b-a)*t) + a;
    },
};

export { StreamUtils };
