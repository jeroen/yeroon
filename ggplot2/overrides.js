Ext.lib.Event.resolveTextNode = Ext.isGecko ? function(node){
	if(!node){
		return;
	}
	var s = HTMLElement.prototype.toString.call(node);
	if(s == '[xpconnect wrapped native prototype]' || s == '[object XULElement]'){
		return;
	}
	return node.nodeType == 3 ? node.parentNode : node;
} : function(node){
	return node && node.nodeType == 3 ? node.parentNode : node;
};

	// EXTRA CODE //
	
function createCookie(name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	return null;
}

function eraseCookie(name) {
	createCookie(name,"",-1);
}
	
function gup( name ) {
  name = name.replace(/[\[]/,"\\\[").replace(/[\]]/,"\\\]");
  var regexS = "[\\?&]"+name+"=([^&#]*)";
  var regex = new RegExp( regexS );
  var results = regex.exec( window.location.href );
  if( results == null )
    return "";
  else
    return results[1];
}	
	
function openWindowWithPost(url,name,keys,values){
	var newWindow = window.open("", name); 
	if (!newWindow) return false;
	var html = "";
	html += "<html><head></head><body><form id='formid' method='post' action='" + url + "'>";
	if (keys && values && (keys.length == values.length))
	for (var i=0; i < keys.length; i++)
	html += "<input type='hidden' name='" + keys[i] + "' value='" + values[i] + "'/>";
	html += "</form><script type='text/javascript'>document.getElementById(\"formid\").submit()</script></body></html>";
	newWindow.document.write(html);
	return newWindow;
}	

Ext.ColorPalette.prototype.unselect=function(fireEvent){
    var el = this.el;
    if(this.value || this.allowReselect){
        var colorEl = this.value ? el.child("a.color-"+this.value) : null;
        if (colorEl) colorEl.removeClass("x-color-palette-sel");
        this.value = undefined;
        if (fireEvent) this.fireEvent("select", this, this.value);
    };
    return this;
};

Ext.iterate = function(obj, fn, scope){
	if(Ext.isEmpty(obj)){
		return;
	}
	if(Ext.isIterable(obj)){
		Ext.each(obj, fn, scope);
		return;
	}else if(Ext.isObject(obj)){
		for(var prop in obj){
			if(obj.hasOwnProperty && obj.hasOwnProperty(prop)){
				if(fn.call(scope || obj, prop, obj[prop], obj) === false){
					return;
				};
			}
		}
	}
}

Ext.override(Ext.form.Action.Submit, {
    handleResponse : function(response){
        if(this.form.errorReader){
            var rs = this.form.errorReader.read(response);
            var errors = [];
            if(rs.records){
                for(var i = 0, len = rs.records.length; i < len; i++) {
                    var r = rs.records[i];
                    errors[i] = r.data;
                }
            }
            if(errors.length < 1){
                errors = null;
            }
            return {
                success : rs.success,
                errors : errors
            };
        }
		try{
			return Ext.decode(response.responseText);
		}catch(e){
			alert('Error in decoding server response. Your data set might contain system characters like backslashes. Please try to avoid this.');
			console.log(response.responseText);
			return false;
		}
    }
});