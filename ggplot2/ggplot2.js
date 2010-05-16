/*!
 * yeroon.net/ggplot2:
 * A web interface for the R package ggplot2.
 * (c) 2010 Jeroen Ooms
 * http://www.jeroenooms.com'
 */
 
Ext.onReady(function(){

	var menuData;
	var gemoMenu;	
	var uploadWindow;
	var dateWindow;
	var cpuURL = "/R";

	function Layer(geom){
		this.geom = geom;
		if(geom=="bar") this.stat= "set_identity"; // this overrides the default stat="bin" in ggplot2.
	}
	
	function PlotConfig(x,y,group,colour,weight,facet){
		this.x = x;
		this.y = y;
		this.group = group;
		this.colour = colour;
		this.weight = weight;		
		this.facet = new Object();
		this.layers = new Object();
	}

	PlotConfig.prototype.set = function(key,value,layerKey) {
		if(layerKey==null){
			if(value == "default"){
				delete this[key];
			} else {
				this[key] = value;
			}
		} else if (layerKey=="facet") {
			if(value == "default"){
				delete this.facet[key];
			} else {
				this.facet[key] = value;
			}
		} else {
			if(value == "default"){
				delete this.layers[layerKey][key];
			} else {
				this.layers[layerKey][key] = value;
			}
		}
	}
	
	PlotConfig.prototype.addLayer = function(geom,layerKey) {
		return this.layers[layerKey] = new Layer(geom);
	}	

	PlotConfig.prototype.removeLayer = function(layerKey) {
		delete this.layers[layerKey];
	}		
	
	PlotConfig.prototype.toJSON = function() {
		return Ext.util.JSON.encode(this);
	}

	PlotConfig.prototype.toString = function() {
		return Ext.util.JSON.encode(this);
	}	
	
	function callR(Rscript,inputList,cbFun,maskElement){
		if(maskElement){
			myMask = new Ext.LoadMask(maskElement, {msg:"Please wait..."});
			myMask.show();
		} else {
			myMask = null;
		}
		Ext.Ajax.request({
			timeout: 60000, //timeout for ajax is in ms
			url: cpuURL + "/" + Rscript,
			method: "POST",
			mask: myMask,
			inputList: inputList,
			params: {
				"inputList" : Ext.util.JSON.encode(inputList)
			},	
			success: function(o, opts){
				if(opts.mask != null) opts.mask.hide();
				try{
					result = Ext.decode(o.responseText);
				}
				catch(err) {
					alert("error in decoding json response:\n\n" + o.responseText);
				}
				finally{
					if(!result) {return false;}
					if(result.success){
						cbFun(result,opts);
					} else {
						alert("R returned an error:\n\n" + result.error);
					}
				}
			},	
			failure: function(response, opts) {
				if(opts.mask != null) opts.mask.hide();
				alert('server-side failure: HTTP' + response.status);
			}
		});
	}	
	
	function plot2syntax(plotConfig){

		syntax = "ggplot(myData, aes(";
		var firstVar = true;
		
		for(z in plotConfig){
			if(typeof(plotConfig[z])=="string" && z != "facet"){
				if(!firstVar) syntax = syntax + ", ";
				syntax = syntax + z + "=" + plotConfig[z].substring(4);
				firstVar = false;
			}	
		}
		syntax = syntax + "))";
		layers = plotConfig.layers;
		
		var blankLayer = true;
		for(everyLayer in layers){
		
			blankLayer = false;
		
			var thisLayer = layers[everyLayer]
			var settings = new Array();
			var mappings = new Array();
			
			for(z in thisLayer){
				if(typeof(thisLayer[z])=="string" && thisLayer[z].substring(0,3) == "set"){
					thisValue = thisLayer[z].substring(4);
					if(thisValue == "FALSE" || thisValue == "TRUE"){
						settings.push(z + '=' + thisLayer[z].substring(4));
					} else if(menuData.Aesthetics[z].type=="numeric") {				
						settings.push(z + '=' + thisLayer[z].substring(4));
					} else {
						settings.push(z + '="' + thisLayer[z].substring(4) + '"');
					}
				}
				if(typeof(thisLayer[z])=="string" && thisLayer[z].substring(0,3) == "map"){
					mappings.push(z + "=" + thisLayer[z].substring(4));
				}
			}
			syntax = syntax + " + geom_" + thisLayer.geom + "(" + settings.join(','); 
			if(mappings.length > 0){
				if(settings.length > 0) syntax = syntax + ', ';
				syntax = syntax + "aes(" + mappings.join(',') + ")";
			}
			syntax = syntax + ")";
		}
		
		if(blankLayer && plotConfig.y != undefined){
			if(plotConfig["y"].substring(4)=="..density.." || plotConfig["y"].substring(4)=="..count.."){
				syntax = syntax + ' + geom_blank(stat="bin")'
			} else {
				syntax = syntax + " + geom_blank()"
			}
		}

		if(plotConfig.facet.map){
			syntax = syntax + " + facet_wrap(~" + plotConfig.facet.map.substring(4);
			if(plotConfig.facet.nrow){
				syntax = syntax + ', nrow = ' + plotConfig.facet.nrow.substring(4);
			}
			if(plotConfig.facet.scales){
				syntax = syntax + ', scales = "' + plotConfig.facet.scales.substring(4) + '"';
			}
			syntax = syntax + ")";
		}
		
		return(syntax);
	}
	
	function scrolldown(){
		var objDiv = document.getElementById('historyCmp');
		objDiv.scrollTop = objDiv.scrollHeight;	
	}
	
	function tryDecode(jsonString){
		try {
			return Ext.util.JSON.decode(jsonString);
		}
		catch(err) {
			//alert("Error in decoding JSON: " + jsonString);
			return false;
		}
	}
	
	function addToTerminal(thisLine){
		myP = document.createElement('p');
		myP.appendChild(document.createTextNode(thisLine));
		Ext.get('historyCmp').appendChild(myP);	
		scrolldown();
	}
	
	function setTerminal(thisLine){
		Ext.DomHelper.overwrite('syntaxdiv', "<pre><code> > " + thisLine + "<img id='cursor' src='images/cursor2.gif' /></code></pre>");
	}
	
	function resetAll(){
		var dataFile = Ext.getCmp('workspace').plotConfig.dataFile;
		Ext.getCmp('workspace').plotConfig = new PlotConfig();
		Ext.getCmp('workspace').plotConfig.dataFile = dataFile;
		
		Ext.getCmp('layerList').getStore().removeAll();
		Ext.getCmp('workspace').load({url:'emptyfile.txt', method:"GET"});
		updateGeneralDetails(Ext.getCmp('workspace').plotConfig)
		updateLayerDetails(null);	
		Ext.getCmp('plotMenu').removeAll();
		geomMenu = buildGeomMenu(menuData);
		buildMenu();
	}
	
	function verifyRequiredAes(plotConfig){
		for(var layerID in plotConfig.layers){
			thisLayer = plotConfig.layers[layerID];
			thisGeom = thisLayer.geom;
			if(menuData.Required[thisGeom]){	
				requirements = menuData.Required[thisGeom];
				for(var reqID = 0; reqID < requirements.length; reqID++){
					thisReq = requirements[reqID];
					if(!thisLayer[thisReq]){
						alert("Aesthetic '" + thisReq + "' is required for 'geom_" + thisGeom + "'. Please set/map it in it's menu, and try again.");
						return false;
					}
				}			
			}		
		}
		return true;
	}
	
	function drawPlot(){

		plotConfig = Ext.getCmp('workspace').plotConfig;	
		
		if(plotConfig.x==null || plotConfig.y==null)
			alert("You need to set X and Y first!");
		else if(verifyRequiredAes(plotConfig)) {
			width = Ext.getCmp('workspace').getSize().width;
			height = Ext.getCmp('workspace').getSize().height;
			plotConfig["width"] = width;
			plotConfig["height"] = height - 40;

			Ext.getCmp('drawButton').disable();
			Ext.getCmp('pdfbutton').disable();
			Ext.getCmp('svgbutton').disable();
			
			addToTerminal(plot2syntax(plotConfig) + ";");
	
			Ext.getCmp('workspace').load({
				timeout: 60, //timeout for load is in seconds
				url: cpuURL + "/ggplot-png",
				method: "POST",
				params: {
					"plotRequest" : plotConfig.toJSON()
				},
				callback: function(el,success,response) {
					Ext.getCmp('drawButton').enable();
					Ext.getCmp('pdfbutton').enable();
					Ext.getCmp('svgbutton').enable();
					plotResult = tryDecode(response.responseText);
					if(plotResult && !plotResult.success) addToTerminal("Error: " + plotResult.error);
				}
			});
		}
	}
	
	function getPDF(){
	
		plotConfig = Ext.getCmp('workspace').plotConfig;
		
		if(plotConfig.x==null || plotConfig.y==null)
			alert("You need to set X and Y first!");
		else {
			myWindow = window.open();
			myWindow.document.write("PDF link will appear here... please wait (don't close this window)\n\n");
			
			Ext.getCmp('pdfbutton').disable();
			Ext.Ajax.request({
				timeout: 60000, //timeout for ajax is in ms
				url: cpuURL + "/ggplot-pdf",
				method: "POST",
				params: {
					"plotRequest" : plotConfig.toJSON()
				},	
				success: function(o){
					try{
						result = Ext.decode(o.responseText);
					}
					catch(err) {
						alert("error in decoding data: " + o.responseText);
					}
					finally{
						Ext.getCmp('pdfbutton').enable();
						if(result.success){
							myWindow.document.write(('<a href="plots/' + result.pdfurl + '">click here to get pdf </a>'));
						} else {
							alert("R returned an error:\n\n" + result.error);
						}
					}
				},
				failure: function() {Ext.getCmp('pdfbutton').enable();}	
			});
		}
	}
	
	function getSVG(){
	
		plotConfig = Ext.getCmp('workspace').plotConfig;
		
		if(plotConfig.x==null || plotConfig.y==null)
			alert("You need to set X and Y first!");
		else {
			myWindow = window.open();
			myWindow.document.write("svg link will appear here... please wait (don't close this window)\n\n");
			
			Ext.getCmp('svgbutton').disable();
			Ext.Ajax.request({
				timeout: 60000, //timeout for ajax is in ms
				url: cpuURL + "/ggplot-svg",
				method: "POST",
				params: {
					"plotRequest" : plotConfig.toJSON()
				},	
				success: function(o){
					try{
						result = Ext.decode(o.responseText);
					}
					catch(err) {
						alert("error in decoding data: " + o.responseText);
					}
					finally{
						Ext.getCmp('svgbutton').enable();
						if(result.success){
							myWindow.document.write(('<a href="plots/' + result.svgurl + '">click here to get svg </a>'));
						} else {
							alert("R returned an error:\n\n" + result.error);
						}
					}
				},
				failure: function() {Ext.getCmp('svgbutton').enable();}	
			});
		}
	}	


	function updateLayerDetails(layerConfig){
		
		htmlString = "<h1> Layer Config:</h1>";
		
		for(prop in layerConfig){
			htmlString = htmlString + "<p>" + prop + ": " + layerConfig[prop] + "</p>"
		}

		document.getElementById('detailDiv').innerHTML = htmlString
		Ext.get('detailDiv').hide().slideIn('t', {stopFx:true,duration:.2});
		
		setTerminal(plot2syntax(Ext.getCmp('workspace').plotConfig));
	}
	
	function updateGeneralDetails(plotConfig){
	
		htmlString = "<h1> Global Options:</h1>";
		
		if(plotConfig.x) htmlString = htmlString + "<p> x: " + plotConfig.x + "</p>";
		else htmlString = htmlString + "<p> <span class='invalid'> x: undefined </span></p>";
		if(plotConfig.y) htmlString = htmlString + "<p> y: " + plotConfig.y + "</p>";
		else htmlString = htmlString + "<p><span class='invalid'> y: undefined </span></p>";
		if(plotConfig.weight) htmlString = htmlString + "<p> weight: " + plotConfig.weight + "</p>";
		if(plotConfig.group) htmlString = htmlString + "<p> group: " + plotConfig.group + "</p>";
		if(plotConfig.colour) htmlString = htmlString + "<p> colour: " + plotConfig.colour + "</p>";
		if(plotConfig.facet.map) htmlString = htmlString + "<p> facet: " + plotConfig.facet.map + "</p>";
		
		numberOfLayers = Ext.getCmp('layerList').getStore().getCount();
		if(numberOfLayers > 0) htmlString = htmlString + "<p> layers: " + Ext.getCmp('layerList').getStore().getCount() + "</p>";
		else htmlString = htmlString + "<p><span class='invalid'>  layers: 0 </span></p>";

		document.getElementById('generalDetailDiv').innerHTML = htmlString
		Ext.get('generalDetailDiv').hide().slideIn('l', {stopFx:true,duration:.2});	

		setTerminal(plot2syntax(plotConfig));
	}
	
	function selectLayer(sm,row,record){
		plotConfig = Ext.getCmp('workspace').plotConfig;
		updateLayerDetails(plotConfig.layers[record.id]);
	}	
	
	function newLayerMenu(geom,aes,layerKey){
		dataVariables = Ext.getCmp('workspace').dataVariables;
		
		thisLayerMenu = new Ext.menu.Item({
			id: layerKey,
			text: "Layer: " + geom, 
			iconCls: "icon_"+ geom,
			handler: function() {return false},
			menu: {items:['<b class="menu-title">Layer: ' + geom + '</b>']}			
		});
		
		for(thisaes=0; thisaes < aes.length; thisaes++){
			
			myAes = aes[thisaes];
			myValues = menuData.Aesthetics[myAes].values;
			
			mapSetMenu = thisLayerMenu.menu.add({
				text: myAes,
				handler: function() {return false},
				iconCls: 'icon_prop',
				key: myAes,
				menu: {}
			});
			
			if(menuData.Aesthetics[myAes].set){
				mapSetMenu.menu.add({
					text: "Set", 
					iconCls: 'icon_set',
					handler: function() {return false},
					menu: makeVarMenu(myAes,myValues,"default",!menuData.Aesthetics[myAes].required,layerKey,"set_",menuData.Aesthetics[myAes].custom)
				});
			}

			newDataVariables = dataVariables;
			if(menuData.Statvar[geom]){
				newDataVariables = menuData.Statvar[geom].concat('-').concat(newDataVariables);
			}			
			
			if(menuData.Aesthetics[myAes].map){
				mapSetMenu.menu.add({
					iconCls: 'icon_map',
					text: "Map", 
					handler: function() {return false},
					menu: makeVarMenu(myAes,newDataVariables,"default",!menuData.Aesthetics[myAes].set,layerKey,"map_",false)
				});
			}
			
		}

		thisLayerMenu.menu.add('-');		

		thisLayerMenu.menu.add({
			text: "Remove Layer",
			iconCls:'delete',
			handler: function() {
				plotConfig.removeLayer(layerKey);
				Ext.getCmp('plotMenu').remove(layerKey); // does not do anything if layers are not added to plotmenu
				removeFromList(layerKey);
				updateLayerDetails(null);
				updateGeneralDetails(Ext.getCmp('workspace').plotConfig);				
			}
		});
		return thisLayerMenu;
	}
	
	function addToList(geom,layerKey){
		Ext.getCmp('layerList').getStore().loadData([[layerKey,geom]], true);
		
		activeRecord = Ext.getCmp('layerList').getStore().getById(layerKey);
		Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);		
		return activeRecord;
	}
	
	function removeFromList(layerKey){
		thisRecord = Ext.getCmp('layerList').getStore().getById(layerKey);
		Ext.getCmp('layerList').getStore().remove(thisRecord);
		Ext.getCmp('layerList').getStore().refreshData();
	}	
	
	function newLayer(geom,aes) {
		plotConfig = Ext.getCmp('workspace').plotConfig;
		var randomKey = "layer" + (Math.floor(Math.random()*90000)+10000)
		plotConfig.addLayer(geom,randomKey);
		//create a new menu
		newMenu = newLayerMenu(geom,aes,randomKey);
		//If the menu should also be added to the main menu:
		//Ext.getCmp('plotMenu').add(thisLayerMenu);
		newRecord = addToList(geom,randomKey);
		newRecord.layerMenu = newMenu;
		updateGeneralDetails(Ext.getCmp('workspace').plotConfig);
		Ext.getCmp('layerList').getSelectionModel().on('rowselect',selectLayer);
	}
	
	var plotMenu = new Ext.menu.Menu({   
		id: 'plotMenu',
		items: [],
		handler: function() {return false;}
	});
	

	
	function makeVarMenu(key,values,selected,addDefault,layer,prefix,addCustom){
		
		if(key=="y") { 
			values = new Array('..count..','..density..','-').concat(values);
		}
		plotConfig = Ext.getCmp('workspace').plotConfig;
		var varMenu = new Ext.menu.Menu({
			//defaults: {hideOnClick: false},
			items: []
		});
			
		if(addDefault){
			myDefault = varMenu.add({
				text: "default",
				key: key,
				value: "default",
				layer: layer,				
				group: layer + key,
				checked: selected == "default",
				handler: function() {
					plotConfig.set(this.key,this.value,this.layer);
					
					if((this.key=="colour" || this.key=="fill") && this.layer != null){
						this.myCP.unselect(false);
					}					

					if(this.layer != null && this.layer != "facet"){
						activeRecord = Ext.getCmp('layerList').getStore().getById(this.layer);
						Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);		
					} else {
						updateGeneralDetails(plotConfig);
					}
				}
			});
			varMenu.add("-");
		}
		var myCP;
		
		if((key=="colour" || key=="fill") & prefix=="set_"){
			varMenu.add(
				myCP = myDefault.myCP = new Ext.ColorPalette({
					layer: layer,
					key: key,
					handler: function(pl,pickedColor){
						// pl == this
						this.customChoise.enable();
						this.customChoise.value = "set_#" + pickedColor;
						this.customChoise.setText("custom: #" + pickedColor);
						this.customChoise.setChecked(true);
						
						plotConfig.set(this.key,"set_#" + pickedColor,this.customChoise.layer);
						activeRecord = Ext.getCmp('layerList').getStore().getById(this.layer);
						Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);	
						Ext.getCmp('plotMenu').hide();
						this.customChoise.getEl().highlight(pickedColor);
					}
				})
			);		
		}		
		
					
		for(thisVal=0; thisVal<values.length; thisVal++){
			if(values[thisVal] == '-'){
				varMenu.add('-');
			} else {
				varMenu.add({
					text: values[thisVal],
					key: key,	
					value: prefix + values[thisVal],
					layer: layer,				
					group: layer + key,
					checked: values[thisVal] == selected,
					handler: function() {
						plotConfig.set(this.key,this.value,this.layer);
							
						if(this.key == "y"){
							if(this.value.substring(4)=="..count.." || this.value.substring(4)=="..density.."){
								Ext.getCmp('addLayerMenu1').enable();
								Ext.getCmp('addLayerMenu2').disable();
								Ext.getCmp('addLayerMenu3').disable();
							} else {
								Ext.getCmp('addLayerMenu1').disable();
								Ext.getCmp('addLayerMenu2').enable();
								Ext.getCmp('addLayerMenu3').enable();
							}
						}						
		
						if(this.layer != null && this.layer != "facet"){
							activeRecord = Ext.getCmp('layerList').getStore().getById(this.layer);
							Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);		
						} else {
							updateGeneralDetails(plotConfig);
						}
					}
				});
			}
		}
		
		if(addCustom){
			varMenu.add("-");
			customChoise = varMenu.add({
				text: "custom: (no value set)",
				key: key,	
				disabled: true,
				value: "default",
				layer: layer,
				myCP: myCP,
				group: layer + key,
				checked: false,				
				handler: function() {
					plotConfig.set(this.key,this.value,this.layer);		
					activeRecord = Ext.getCmp('layerList').getStore().getById(this.layer);
					Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);						
				},
				listeners: {
					'checkchange': function(item, checked) {
						if(!checked){
							if(this.key=="colour" || this.key=="fill") this.myCP.unselect(false);
							this.setText("custom: (no value set)");
							this.disable();
						}
					}
				}
			});
			
			if(key=="colour" || key=="fill"){
				myCP.customChoise = customChoise;
			}
			
			thisField = varMenu.add({
				xtype: "buttongroup",
				autoWidth: true,
				columns: 2,
				defaults: {
                    iconAlign: 'left'
                },
				items:[	]
			});
			
			if(menuData.Aesthetics[key].type == "numeric") {
				customValueField = thisField.add({xtype: 'numberfield', allowBlank: false, validateOnBlur: false, text:'custom value'});
			} else {
				customValueField = thisField.add({xtype: 'textfield', allowBlank: false, validateOnBlur: false, text:'custom value'});
			}
				
			thisField.add({customChoise: customChoise, myCP:myCP, key: key, layer: layer, varMenu: varMenu, customValueField: customValueField, text: 'set value', handler: function() {
	
				if(!this.customValueField.validate()){
					return false;
				}
				if(this.key=="colour" || this.key=="fill") {
					this.myCP.unselect(false);
				}
				var theValue = this.customValueField.getValue();
				this.customChoise.enable();
				this.customChoise.value = "set_" + theValue;
				this.customChoise.setText("custom: " + theValue);
				this.customChoise.getEl().highlight();
				this.customChoise.setChecked(true);
				
				if(this.customChoise.checked){
					plotConfig.set(this.customChoise.key,this.customChoise.value,this.customChoise.layer);		
					activeRecord = Ext.getCmp('layerList').getStore().getById(this.layer);
					Ext.getCmp('layerList').getSelectionModel().selectRecords([activeRecord]);				
				}
				
				this.customValueField.reset();
				//Ext.getCmp('plotMenu').hide();
			}});
		}		
		
		return varMenu;
	}
	
	function buildMenu(){
		dataVariables = Ext.getCmp('workspace').dataVariables;	
		var Defaults = menuData.Defaults;
		for(i = 0; i < Defaults.length; i++){
			if(Defaults[i]=="-"){
				Ext.getCmp('plotMenu').add("-");					
			} else {
				if(Defaults[i].required){
					Ext.getCmp('plotMenu').add({
						"id" : "mapping"+Defaults[i].name,
						"text" : "Map " + Defaults[i].name + " (required)",
						"iconCls" : "icon_map",
						handler: function() {return false;},
						menu: makeVarMenu(Defaults[i].name,Ext.util.JSON.decode(Ext.util.JSON.encode(dataVariables)),"default",false, null, "map_")
					});
				} else {
					Ext.getCmp('plotMenu').add({
						"id" : "mapping"+Defaults[i].name,
						"text" : "Map " + Defaults[i].name,
						"iconCls" : "icon_map",
						handler: function() {return false;},
						menu: makeVarMenu(Defaults[i].name,Ext.util.JSON.decode(Ext.util.JSON.encode(dataVariables)),"default",true, null, "map_")
					});
				}
			}
		}
		
		facetMenu = Ext.getCmp('plotMenu').add({
			id: "facet",
			"text" : "Facet",
			iconCls: 'icon_facet',
			handler: function() {return false;},
			menu: {}
		});	
		Ext.getCmp('plotMenu').add('-');
		
		facetProperties = menuData.Facet
		
		for(thisaes=0; thisaes < facetProperties.length; thisaes++){
			
			thisProp = facetProperties[thisaes];
			
			if(thisProp.set){
				facetMenu.menu.add({
					text: thisProp.name,
					handler: function() {return false},
					iconCls: 'icon_set',
					key: thisProp.name,
					menu: makeVarMenu(thisProp.name,thisProp.values,"default",true,"facet","set_")
				});						
			}
			
			else if(thisProp.map){
				facetMenu.menu.add({
					text: thisProp.name,
					handler: function() {return false},
					iconCls: 'icon_map',
					key: thisProp.name,
					menu: makeVarMenu(thisProp.name,dataVariables,"default",true,"facet","map_")
				});							
			}
		}					

		Ext.getCmp('plotMenu').add({
			text: "Add Layer",
			iconCls: 'add',
			menu: Ext.getCmp('geomMenu'),
			handler: function() {return false}
		});
	}
	
	function getMenuData(){
		Ext.Ajax.request({
			url: 'menuData.json',
			success: function(o){
				try{
					menuData = Ext.decode(o.responseText);
				}
				catch(err) {
					alert("error in decoding menuData.json");
				}
				finally{
					geomMenu = buildGeomMenu(menuData);
				}
			},
			failure: function() {alert('menuData.json could not be loaded');}		
		});
	}
	
	function buildGeomMenu(menuData){
		geomMenu = new Ext.menu.Menu({   
			id: 'geomMenu',
			items: ['<b class="menu-title">Add New Layer</b>'],
			handler: function() {return false;}
		});	
	
		Ext.getCmp('geomMenu').add({
			id: "addLayerMenu1",
			"text" : "Univariate Geoms",
			iconCls: 'add',
			handler: function() {return false;},
			disabled: true,
			menu: {
		//		listeners: [],
		//		items: []
			}				
		});		
		
		var Geoms1 = menuData.Geoms1;
		for(i=0; i < Geoms1.length; i++){
			Ext.getCmp('addLayerMenu1').menu.add({
				text: Geoms1[i].geom,
				iconCls : "icon_" + Geoms1[i].geom,
				geom: Geoms1[i].geom,
				aes: Geoms1[i].aes,	
				values: Geoms1[i].values,
				id: "geom_"+Geoms1[i].geom,
				handler: function() {newLayer(this.geom,this.aes)}
			});
		}					
		
		Ext.getCmp('geomMenu').add({
			id: "addLayerMenu2",
			"text" : "Bivariate Geoms",
			iconCls: 'add',
			handler: function() {return false;},
			disabled: true,
			menu: {
			//	listeners: [],
			//	items: []
			}				
		});
		
		var Geoms2 = menuData.Geoms2;
		for(i=0; i < Geoms2.length; i++){
			Ext.getCmp('addLayerMenu2').menu.add({
				text: Geoms2[i].geom,
				iconCls : "icon_" + Geoms2[i].geom,
				geom: Geoms2[i].geom,
				aes: Geoms2[i].aes,	
				values: Geoms2[i].values,
				id: "geom_"+Geoms2[i].geom,
				handler: function() {newLayer(this.geom,this.aes)}
			});
		}
		
		Ext.getCmp('geomMenu').add({
			id: "addLayerMenu3",
			"text" : "fixed lines/bars",
			iconCls: 'add',
			handler: function() {return false;},
			disabled: true,
			menu: {
			//	listeners: [],
			//	items: []
			}				
		});
		
		var Geoms3 = menuData.Geoms3;
		for(i=0; i < Geoms3.length; i++){
			Ext.getCmp('addLayerMenu3').menu.add({
				text: Geoms3[i].geom,
				iconCls : "icon_" + Geoms3[i].geom,
				geom: Geoms3[i].geom,
				aes: Geoms3[i].aes,	
				values: Geoms3[i].values,
				id: "geom_"+Geoms3[i].geom,
				handler: function() {newLayer(this.geom,this.aes)}
			});
		}
		return gemoMenu;
	}
	
	imageContext = function(e,t,o){
	
		plotConfig = Ext.getCmp('workspace').plotConfig;
		//thisLayer = Ext.getCmp('layerList').getSelectionModel().getSelected().id;
		plotMenu.showAt(e.getPoint());	
		e.stopEvent();
	}	
	
	function showUploadWindow(animTarget) {
		if(uploadWindow) return;
		uploadWindow = new Ext.Window({
			width: 600,
			height: 400,
			resizable: false,
			id: 'uploadWindow',
			//closeAction:'hide',
			title: "Upload Data",
			//plain: true,
			border: false,
			items: [
				{
					xtype:'form',
					id:'uploadForm',
					autoHeight: true,
					autoWidth: true,
					frame: true,
					fileUpload: true,
					border: false,
					bodyStyle: 'padding: 5px 10px 5px 10px;',
					labelWidth: 60,
					defaults: {
						anchor: '100%'
					},				
					items: [
						{
							xtype: 'fileuploadfield',
							id: 'fileuploadfield',
							name: 'datafile',
							emptyText: 'Upload any .csv, .txt, .xls, .sav, .dta ... ',
							listeners: {'fileselected': uploadData},
							fieldLabel: 'Data File'
						},
						{
							xtype:'fieldset',
							title: 'import options',
							collapsible: true,
							collapsed: true,
							forceLayout: true,
							layout:'column',
							listeners: {'collapse':function(){Ext.getCmp('guessGrid').setHeight(253)}, 'expand':function(){Ext.getCmp('guessGrid').setHeight(185)}},
							items:[{
								columnWidth:.5,
								layout: 'form',
								defaults:{
									xtype: 'combo',
									mode: 'local',
									editable: false,
									typeAhead: false,
									triggerAction: 'all',
									labelWidth: 100,
									disabled: true,
									anchor:'95%',
									listeners: {'select': customImport}
								},
								items: [{
									fieldLabel: 'Type',
									name: 'type',
									id: 'guessType',
									store: ['csv','csv2','delim','delim2']
								}, {
									fieldLabel: 'Header',
									id: 'guessHeader',
									name: 'header',
									store: [true,false]
								}]
							},{
								columnWidth:.5,
								layout: 'form',
								defaults:{
									xtype: 'combo',
									mode: 'local',
									editable: false,
									typeAhead: false,
									triggerAction: 'all',
									labelWidth: 100,
									disabled: true,
									anchor:'95%',
									listeners: {'select': customImport}
								},						
								items: [{
									fieldLabel: 'Seperator',
									name: 'sep',
									id: 'guessSep',
									store: [[',',', (comma)'],[';','; (semicolon)'],['\t', '\\t (tab)'],["",'"" (White Space)']]
								},{
									fieldLabel: 'Decimal',
									id: 'guessDec',
									name: 'dec',
									store: [['.','. (dot)'],[',',', (comma)']]
								}]
							}]
						},{
							xtype: 'grid',
							enableHdMenu: false,
							draggable: false,
							enableColumnMove: false,
							id: 'guessGrid',
							cls: 'guessGrid', //for the border
							height: 187,
							autoWidth: true,	
							//viewConfig: {scrollOffset: 2},
							//columns:[{header:""}], 
							cm:	new Ext.grid.ColumnModel({id:'dataCM'}),
							store: new Ext.data.ArrayStore({id:'dataStore'}),
							//border: true,
							frame: false
						}
					]
				}],
			buttons: [{
				text:'Import',
				id: 'importButton',
				disabled: true,
				handler: function(){importData(this.tempDataFile);}
			}],
			listeners: {'beforedestroy': function() {uploadWindow = null}}
		});
		uploadWindow.show(animTarget);
		Ext.getCmp('uploadForm').getForm().waitMsgTarget = Ext.getCmp('uploadWindow').getLayoutTarget();
	}
	
	function uploadData(filebox,value) {	
		Ext.getCmp('importButton').disable();
		Ext.getCmp('uploadForm').getForm().submit({
			method: 'post',
			url: cpuURL + "/uploadGuess",
			waitMsg: 'Uploading data...',
			success: function(uploadForm, o){
				if(!o.result){
					alert("Error in uploading data. Try a different server");
					return false;
				}
				if(typeof(o.result.output.variableNames)=="string"){
					//if there is only one variable, R might return a string instead of array
					o.result.output.variableNames = new Array(o.result.output.variableNames);
				}
				reconfigureGrid(o.result.output);
				Ext.getCmp('importButton').tempDataFile = o.result.output.dataFile;
				Ext.getCmp('guessType').setValue(o.result.output.guess.type);
				Ext.getCmp('guessHeader').setValue(o.result.output.guess.header);
				Ext.getCmp('guessSep').setValue(o.result.output.guess.sep);
				Ext.getCmp('guessDec').setValue(o.result.output.guess.dec);
				
				dataType = o.result.output.guess.type;
				if(dataType == "csv" | dataType == "csv2" | dataType == "delim" | dataType == "delim2"){
					Ext.getCmp('guessType').enable();
					Ext.getCmp('guessHeader').enable();
					Ext.getCmp('guessSep').enable();
					Ext.getCmp('guessDec').enable();
				} else {
					Ext.getCmp('guessType').disable();
					Ext.getCmp('guessHeader').disable();
					Ext.getCmp('guessSep').disable();
					Ext.getCmp('guessDec').disable();			
				}
				if(dataType == "xls"){
					Ext.getCmp('guessHeader').enable();
				}
				
				if(o.result.output.error) {
					Ext.getCmp('importButton').disable();
					alert(o.result.output.error);
				} else {
					Ext.getCmp('importButton').enable();
				}
			},
			failure:function(uploadForm, o){
				reconfigureGrid({"variableNames":[],"variableData":[]});
				Ext.getCmp('importButton').disable();
				Ext.getCmp('guessType').disable();
				Ext.getCmp('guessHeader').disable();
				Ext.getCmp('guessSep').disable();
				Ext.getCmp('guessDec').disable();					
				alert('R catched an error: '+o.result.error);				
			}
		});	
	}
	
	function customImport(){
		dataType = Ext.getCmp('guessType').value;
		dataHeader = Ext.getCmp('guessHeader').value;
		dataSep = Ext.getCmp('guessSep').value;
		dataDec = Ext.getCmp('guessDec').value;	
		dataFile = Ext.getCmp('importButton').tempDataFile;
		
		function updateGrid(outputList){
			if(typeof(outputList.variableNames)=="string"){
				//if there is only one variable, R might return a string instead of array
				outputList.variableNames = new Array(outputList.variableNames);
			}
			reconfigureGrid(outputList);
			Ext.getCmp('guessType').setValue(outputList.guess.type);
			Ext.getCmp('guessHeader').setValue(outputList.guess.header);
			Ext.getCmp('guessSep').setValue(outputList.guess.sep);
			Ext.getCmp('guessDec').setValue(outputList.guess.dec);
			if(outputList.error) {
				Ext.getCmp('importButton').disable();
				alert(outputList.error);
			} else {
				Ext.getCmp('importButton').enable();
			}
			if(outputList.error) {
				Ext.getCmp('importButton').disable();
				alert(o.result.output.error);
			} else {
				Ext.getCmp('importButton').enable();
			}			
		}
		Ext.getCmp('importButton').disable();
		callR("customImport",{dataType:dataType,dataHeader:dataHeader,dataSep:dataSep,dataDec:dataDec,dataFile:dataFile},updateGrid,Ext.getCmp('uploadWindow').getLayoutTarget());
	}
	
	function importData(tempDataFile){
		Ext.getCmp('importButton').disable();
		var myMask = new Ext.LoadMask(Ext.getCmp('uploadWindow').getLayoutTarget(), {msg:"Please wait..."});
		myMask.show();		
		
		Ext.Ajax.request({
			timeout: 60000, //timeout for ajax is in ms
			url: cpuURL + "/listVariables",
			method: "POST",
			params: {
				"dataFile" : tempDataFile
			},	
			success: function(o){
				myMask.hide();
				Ext.getCmp('importButton').enable();
				try {
					varListing = Ext.decode(o.responseText);
				}							// add variables to menu
				catch(err) {
					alert("error in decoding menuData.json");
				}
				finally {
					if(varListing && !varListing.success){
						alert(varListing.error);
					}
					else if(varListing && varListing.success){
						variables = varListing.variables[0].children.concat(varListing.variables[1].children);
						dataVariables = new Array();
						for(thisV=0; thisV < variables.length; thisV++){
							dataVariables[thisV] = variables[thisV].text;
						}
						Ext.getCmp('workspace').dataVariables = dataVariables;
						buildMenu();
						Ext.getCmp('resetbutton').enable();
						Ext.getCmp('workspace').getEl().on('contextmenu', imageContext);
						// variable tree stuff
						rootNode = Ext.getCmp('tree-panel').getRootNode();
						// clear current tree:
						while (rootNode.childNodes.length > 0) {
							rootNode.removeChild(rootNode.item(0));
						}
						// add data to tree and DV
						Ext.getCmp('tree-panel').getRootNode().appendChild(varListing.variables);
						Ext.getCmp('workspace').plotConfig["dataFile"] = varListing.dataFile;
						Ext.getCmp('tree-panel').dataFile = varListing.dataFile;
						updateGeneralDetails(Ext.getCmp('workspace').plotConfig);	
						
						// add some syntax:
						if(Ext.getCmp('fileuploadfield')){ //fix that checks if this is a file upload or google upload
							filename = Ext.getCmp('fileuploadfield').value;	
							dataType = Ext.getCmp('guessType').value;
							dataHeader = Ext.getCmp('guessHeader').value ? "T":"F";
							dataSep = Ext.getCmp('guessSep').value == "\t" ? "\\t" : Ext.getCmp('guessSep').value;
							dataDec = Ext.getCmp('guessDec').value;	
							
							if(dataType == "dta") {
								addToTerminal('library(foreign);');
								var command = 'myData <- read.dta("' + filename + '");';
							} else if (dataType == "spss"){
								addToTerminal('library(foreign);');
								var command = 'myData <- read.spss("' + filename + '", to.data.frame=T);';
							} else if (dataType == "rda"){
								var command = 'myData <- load("' + filename + '");';
							} else if (dataType == "xls"){
								addToTerminal('library(gdata);');
								var command = 'myData <- read.xls("' + filename + '", header=' + dataHeader + ');';
							} else {
								var command = 'myData <- read.' + dataType + '("' + filename + '", header=' + dataHeader + ', sep="' + dataSep + '", dec="' + dataDec + '");';
							}
							addToTerminal(command);		
						} else {
							addToTerminal("# Please download your data manually from google spreadsheets to .csv");	
							addToTerminal("myData <- read.csv('myData.csv');");
						
						}
						
						//close window:
						Ext.getCmp('uploadWindow').close();
						Ext.getCmp('openDataButton').disable();
						Ext.getCmp('closeDataButton').enable();
					}
				}
			},
			failure:function(fp, o){
				myMask.hide();
				Ext.getCmp('importButton').enable();
				alert('R catched an error: '+o.result.error);
			}
		});	
	}	
	
	function reconfigureGrid(output){
	
		var columns = new Array();
		for(var i = 0; i < output.variableNames.length; i++){
			columns[i] = {header: output.variableNames[i]}
		}
		
		var newCm = new Ext.grid.ColumnModel({
			columns: columns		
		});
		
		var newStore = new Ext.data.ArrayStore({
			fields: output.variableNames,
			data: output.variableData
			//idIndex: 0 // id for each record will be the first element
		});
		
		Ext.getCmp('guessGrid').reconfigure(newStore,newCm);
	}
	
	function POSIX(newValue){
		var exampleString = newValue;
		var keys = ["%a","%A","%b","%B","%c","%d","%H","%I","%j","%m","%M","%p","%S","%U","%w","%W","%x","%X","%y","%Y"];
		var values = ["Sat","Saturday","Apr","April","4/17/2010 3:05:45 PM","17","15","03","107","04","05","PM","45","15","6","15","4/17/2010","3:05:45 PM","10","2010"];
		for(var thisDateKey = 0; thisDateKey < keys.length; thisDateKey++){
			exampleString = exampleString.replace(keys[thisDateKey],values[thisDateKey]);
		}
		return(exampleString);
	}	
	
	function array2POSIX(dateFields){
		outputData = [];
		for(var i = 0; i < dateFields.length; i++){
			outputData[i] = [dateFields[i],POSIX(dateFields[i])]
		}
		return outputData;									
	}
	
	function convertVariable(dropEvent){
		if(dropEvent.target.id=="ggfolder_Numeric"){
			Ext.MessageBox.show({
			   title: 'Convert to numeric',
			   msg: 'Are you sure you want to convert variable "' + dropEvent.dropNode.id + '" to Numeric? This will transform all current categories to values 1,2,3,...,etc in alphabetical order.',
			   width:300,
			   buttons: Ext.MessageBox.OKCANCEL,
			   animEl: Ext.getCmp('tree-panel').getEl(),
			   fn: function(x){
					if(x=="ok") doConvert(dropEvent.dropNode.id,"Numeric","");
			   }
		   });		
		}
		else if(dropEvent.target.id=="ggfolder_Factor"){
			Ext.MessageBox.show({
			   title: 'Convert to numeric',
			   msg: 'Are you sure you want to convert variable "' + dropEvent.dropNode.id + '" to Factor? This will remove any numerical information and create a category for every unique value.',
			   width:300,
			   animEl: Ext.getCmp('tree-panel').getEl(),
			   buttons: Ext.MessageBox.OKCANCEL,
			   fn: function(x){
					if(x=="ok") doConvert(dropEvent.dropNode.id,"Factor","");
			   }
		   });			
		} else if(dropEvent.target.id=="ggfolder_Date"){
			if(dateWindow) return false;
			dateWindow = new Ext.Window({
				width: 300,
				height: 205,
				id: 'dateWindow',
				resizable: false,
				border: false,
				title: 'Convert variable to Date / Time',
				items: [{
						height:70,
						html: '<p>To convert variable <b>' + dropEvent.dropNode.id+ '</b> to Date or Time, please choose in which format the date or time is specified in your data. For more information about the conversion codes, visit <a target="_blank" href="http://www.opengroup.org/onlinepubs/009695399/functions/strptime.html">this page</a>.</p>'
					},{
						xtype:'form',
						height: 72,
						autoWidth: true,
						frame: true,
						border: false,
						bodyStyle: 'padding: 5px 10px 5px 10px;',
						labelWidth: 100,
						defaults: {
							anchor: '100%'
						},
						items:[
							{
								fieldLabel: 'Example Format',
								triggerAction: 'all',
								id: 'exampleDate',
								xtype: 'combo',
								valueField: 'format',
								displayField: 'date',							
								store: {
									xtype: 'arraystore',
									fields: ['format','date'],
									data: array2POSIX(['%Y-%m-%d', '%Y/%m/%d', '%B %d', '%d%b%Y', '%H:%M:%S','%I:%M:%S %p', 'Week %W Day %w'])
								},
								listeners:{
									'select':function(cb,record){
										Ext.getCmp('formatField').setValue(record.get('format'));								
									}
								},
								editable: false,
								mode: 'local',
								typeAhead: false
							},{
								fieldLabel: 'Format code',
								enableKeyEvents: true,
								xtype: 'textfield',
								id: 'formatField',
								listeners : {
									'keyup': function(field,event){
										var exampleString = field.getRawValue();
										var keys = ["%a","%A","%b","%B","%c","%d","%H","%I","%j","%m","%M","%p","%S","%U","%w","%W","%x","%X","%y","%Y"];
										var values = ["Sat","Saturday","Apr","April","4/17/2010 3:05:45 PM","17","15","03","107","04","05","PM","45","15","6","15","4/17/2010","3:05:45 PM","10","2010"];
										for(var thisDateKey = 0; thisDateKey < keys.length; thisDateKey++){
											exampleString = exampleString.replace(keys[thisDateKey],values[thisDateKey]);
										}
										Ext.getCmp('exampleDate').setValue(exampleString);
									}
								}
							}
						]					
					}
				],
				listeners: {'close': function(){dateWindow = null}},
				buttons: [{text:'OK', varName: dropEvent.dropNode.id, handler: function(){ doConvert(this.varName,"Date",Ext.getCmp('formatField').getRawValue())}},{text:'CANCEL', handler: function(){dateWindow.close();}}]				
			});
			dateWindow.show(Ext.getCmp('tree-panel').getEl());
		}
		Ext.getCmp('tree-panel').getNodeById(dropEvent.target.id).expand(); // this is needed, otherwise appendChild might fail.
		
		function updateTree(outputList,opts){
			theNode = Ext.getCmp('tree-panel').getNodeById(opts.inputList.varName).remove(false);
			newNode = {id:theNode.id, text: theNode.text, leaf:true};
			//bugfix to prevent id dupes for variables named 'Date' or 'factor' or 'numeric'
			var newname = 'ggfolder_' + opts.inputList.targetType;
			//
			Ext.getCmp('tree-panel').getNodeById(newname).appendChild(newNode);
			var syntaxTargetType = opts.inputList.targetType == "Date" ? opts.inputList.targetType : opts.inputList.targetType.toLowerCase();
			if(opts.inputList.targetType == "Date"){
				var syntax = "myData$" + opts.inputList.varName + " <- as.Date(myData$" + dropEvent.dropNode.id + ", format=\"" + opts.inputList.dateFormat +"\");";
			} else {
				var syntax = "myData$" + opts.inputList.varName + " <- as." + syntaxTargetType +"(" + "myData$" + dropEvent.dropNode.id + ");";
			}
			addToTerminal(syntax);
			if(dateWindow){
				dateWindow.close();
				dateWindow = null;
			}
		}
		function doConvert(varName,targetType,formatString){
			callR(
				"convertVariable", {
					dataFile: Ext.getCmp('workspace').plotConfig["dataFile"], 
					varName: varName, //dropEvent.dropNode.id, 
					targetType: targetType, //dropEvent.target.id,
					dateFormat: formatString
				},
				updateTree,
				Ext.getCmp('tree-panel').getEl()
			);	
		}
		return false;
	}
	
	function getToken(){

		myToken = readCookie('token');
		if(myToken!=null && myToken!=""){
			return myToken;
		} else {
			var answer = confirm("No valid google session has been found. Do you want to log-in to your Google account now? This will open a new window.")
			if(answer){
				theURL = "https://www.google.com/accounts/AuthSubRequest?next=http://" + window.location.host + "/R/googleLogin%3Fdomain%3D"+window.location.host+"&scope=https://docs.google.com/feeds/%20http://spreadsheets.google.com/feeds/%20https://docs.googleusercontent.com/&session=1&secure=0";
				newWin = window.open(theURL);
				newWin.focus();
				return false;
			}
		}
	}
	
    function renderLink(val){
        return '<a alt="link to the spreadsheet" target="_blank" href="'+val+'"> <img src="icons/spreadsheet.gif"></a>';
    }	
	
	function openGoogleWindow(animTarget){
		myToken = getToken();
		if(!myToken) return;
		if(uploadWindow) return;

		uploadWindow = new Ext.Window({
			width: 600,
			height: 400,
			resizable: false,
			token: myToken,
			id: 'uploadWindow',
			//closeAction:'hide',
			title: "Google spreadsheets",
			//plain: true,
			frame: true,
			border: false,
			layout:'card',
			activeItem: 0,
			items: [
				{
					xtype: 'grid',
					enableHdMenu: false,	
					draggable: false,
					id: 'uploadGrid',
					enableColumnMove: false,
					height: 337,
					autoWidth: true,
					stripeRows:true,
					//viewConfig: {scrollOffset: 2},
					columns:[{header:"ResourceId",hidden:true},{header:"name",width:180, sortable:true},{header:"published", sortable:true, width:80},{header:"author", width:100},{header:"email",width:150},{header:"link", renderer: renderLink, width:30}], 
					store: new Ext.data.ArrayStore({
						fields: [{name:"ResourceId"},{name:"name"},{name:"published"},{name:"author"},{name:"email"},{name:"link"}]					
					}),
					frame: true		
				}			
			],
			buttons: [
				{text:'import', 
				id: 'importButton',
				token: myToken,
				handler: function(btn){	
					if(!Ext.getCmp('uploadGrid').getSelectionModel().getSelected()){
						alert("No dataset selected");
						return;
					}
					function loadSpreadsheet(result){
						importData(result.output.dataFile);
					}
					thisResource = Ext.getCmp('uploadGrid').getSelectionModel().getSelected().get('ResourceId');
					thisName = Ext.getCmp('uploadGrid').getSelectionModel().getSelected().get('name')
					thisToken = this.token;					
					
					callR("importSpreadsheet",{token:myToken,resourceId:thisResource,filename:thisName},loadSpreadsheet,Ext.getCmp('uploadWindow').getLayoutTarget());
					
				}
			}],
			listeners:{'beforedestroy': function() {uploadWindow = null},'show':function(){callR("listSpreadsheets",{token:myToken},updateSpreadsheets,Ext.getCmp('uploadGrid').getEl());}}
		});
		uploadWindow.show(animTarget);	
		function updateSpreadsheets(result){
			Ext.getCmp('uploadGrid').getStore().loadData(result.output.entries);
		}
	}
	
    var treePanel = new Ext.tree.TreePanel({
		border: true,
		margins:'3 3 0 3',
		singleExpand: false,
		enableDD: true,
		dropConfig: {allowParentInsert: false, appendOnly: true, moveOnly: true, ignoreSelf: true},
		//ddAppendOnly: true,
		bodyStyle: 'padding: 5px 5px 5px 5px;',	
    	id: 'tree-panel',
		region: 'center',
		iconCls: 'downArrow',
    	//title: 'by Index',
        autoScroll: true,
        animate: true,
        //containerScroll: true,
    
        // tree-specific configs:
        rootVisible: false,
        lines: false,
        useArrows: true,
		listeners: {	
			'nodedragover': function(event) {if (!event.dropNode.leaf || event.dropNode.parentNode == event.target) return false},
			'beforenodedrop': convertVariable},
        root: new Ext.tree.AsyncTreeNode({id:'root1'})
    });
	
	var treeSorter = new Ext.tree.TreeSorter(treePanel, {});	

	var detailsPanel = {
		region: 'south',	
		border: true,
		margins:'3 3 3 3',
		id: 'details-panel',
		height: 165,
		bodyStyle: {
			background: '#ffffff',
			padding: '7px'
		},
		html: '<div id="generalDetailDiv"> <h1> General options </h1> </div>'
    };

	var dataPanel = {
		id: 'dataPanel',
		collapsible: true,
		floatable: false,
		region: 'east',
		layout: 'border',
		border: true,
		title: "Data Panel",
		margins:'5 5 5 5',
        width: 200,		
		listeners: {'expand': checkUncheck, 'collapse': checkUncheck},
		items: [treePanel,detailsPanel]		
	}
	
	var workspacePanel = {
		id: 'workspace',
		layout:'fit',
		//items: {xtype: 'chart', id:'chartBox', url: 'test.swf'},
		//bodyStyle: 'background: #DFE8F6;',
		region:'center',
		html: '<div class="start-div"><div style="float:left; margin: 0 0 0 0; padding 0 0 0 0;" ><img src="images/layout-icon.gif" /></div><div style="display: block; margin-left:100px;"> <h2>yeroon.net/ggplot2. Version 0.2.</h2><div><p>How to use:</p><p><b>1. Open a dataset</b>. Make sure every column has a header.</p><p><b>2. Right mouseclick</b> somewhere in this plotarea to open the plot menu.</p> <p><b>3. Map X and Y</b> to a variable and <b>add Geom layers.</b></p><div id="demovideo"><p>Click <a href="http://www.youtube.com/watch?v=7XGN6OSCq6E&hd=1" target="_blank">Here</a> for a short how-to Demo Video!</p></div></div>',
		border: true,
		margins:'5 0 5 0',
		buttons: [{text:'Draw plot', id:'drawButton', iconCls: 'fit', handler: function(){drawPlot()}},{text:'Reset', id:'resetbutton', iconCls: 'reset', disabled: true, handler: function(){resetAll()}}]	
	}
	
    var layerList = new Ext.grid.GridPanel({
		id: 'layerList',
		mode: 'local',
        store: new Ext.data.ArrayStore({
			fields: ['id', 'Geom'],
			data: [
				//[1, '...']	
			],
			idIndex: 0, // id for each record will be the first element
			refreshData: function(){
				var data = this.getRange();
				this.removeAll();
				this.add(data);			
			}
		}),
        columns: [new Ext.grid.RowNumberer(),
            {header: "Geom", width: 120, dataIndex: 'Geom', sortable: true}
        ],
		sm: new Ext.grid.RowSelectionModel({singleSelect: true}),
        viewConfig: {
            forceFit:true
        },
        //columnLines: true,
        height:200,
		//split: true,
		border: true,
		margins:'3 3 0 3',
		hideHeaders: true,
		autoScroll: true,
		listeners: {
			'rowcontextmenu': function(grid, index, e) {
				this.getSelectionModel().selectRow(index);
				e.stopEvent();
			    this.getStore().getAt(index).layerMenu.menu.showAt(e.getPoint());
			},
			'contextmenu': function(e) {
				// for some reason 'containercontextmenu' does not work so we do it manually:
				var item = e.getTarget('table');
				if(!item) {
					e.stopEvent();
					Ext.getCmp('geomMenu').showAt(e.getPoint());				
				}
			}
		},
		region: 'center'//,
		//fbar: [{iconCls: 'newModel', text: 'Add Layer',handler: function(){newLayer();}},{text: 'Remove Layer'}]
    });	
	
	var layerDetails = {
		margins:'3 3 3 3',
		id: 'layerDetails',
		layout: 'fit',
		html: '<div id="detailDiv"> <h1> Layer options </h1> </div>',
		region: 'south',
		height: 165,
		bodyStyle: {
			background: '#ffffff',
			padding: '7px'
		},
		//buttons: [{text: 'Get PDF', id:'pdfbutton', iconCls: 'pdf', handler: function() {getPDF()}},{text:'Cite!', iconCls: 'bib', handler: function() {showCiteWindow();}}],
		border:true
	}	
	
	var layerPanel = {
		//bodyStyle: 'background-color: #AAAAEE;',
		id: 'layerPanel',
		collapsible: true,
		floatable: false,
		//header: false,
		region: 'west',
		layout: 'border',
		margins:'5 5 5 5',
		width: 200,
		border: true,
		title: "Layers Panel",
		listeners: {'expand': function(p){checkUncheck(p); Ext.getCmp('layerList').getStore().refreshData();}, 'collapse': checkUncheck},
		items: [layerList,layerDetails]
	}	
	
	var syntaxPanel = {
		title: 'Syntax',
		collapsible: true,
		collapsed: true,
		titleCollapse: false,
		floatable: false,
		header: false,
		split: true,
		collapseMode: 'mini',
		layout: {type: 'vbox', align:'stretch', pack :'start'},
		id: 'syntaxPanel',
		region: 'south',
		//hidden: true,
		border: false,
		items:[
			{
				border: false,
				flex: 1,
				html: Ext.get('historyCmp')
			},
			{
				border: false,
				height: 30,
				html: Ext.get('syntaxdiv')
			}		
		],
		//split: true,
		height: 120,
		listeners: {'expand': function(p) {scrolldown(); checkUncheck(p)}, 'collapse': checkUncheck}
	}
	
	function hideShowMgr(btn,event){
		//EXT BUG?? btn.checked seems to have opposite value of what you expect.
		if(!btn.checked) Ext.getCmp(btn.panel).expand();
		else Ext.getCmp(btn.panel).collapse();	
	}
	
	function checkUncheck(panel){
		Ext.getCmp(panel.id + "CheckBox").setChecked(!panel.collapsed);
	}
	
	function changeCPU(cb,record){
		newUrl = record.get('url');
		if(uploadWindow || Ext.getCmp('workspace').plotConfig.dataFile){
			alert("You cannot switch to a different CPU server in the middle of a session. Please your current dataset and any open windows before switching CPU servers.");
			return false;
		}
		cpuURL = newUrl;
	}

	mainMenuBar = new Ext.Toolbar({
		region: 'north',
		cls: 'mainMenuBar',
		items:['-',
			{
				xtype: 'button',
				text: 'Open Data',
				id: 'openDataButton',
				iconCls: 'menuOpen',
				scale: 'medium',
				menu:{
					items: [{
						text: 'Upload File',
						iconCls: 'icon_csv',
						handler: function() {showUploadWindow(this.getEl());}
						},{
						text: 'Google Spreadsheet',
						iconCls: 'icon_spreadsheet',
						disabled: false,
						handler: function() {openGoogleWindow(this.getEl());}
						},{
						text: 'Database',
						iconCls: 'icon_database',
						disabled: true
						}
					]
				}
			},{
				text: 'Close Data',
				iconCls: 'menuClose',
				id: 'closeDataButton',
				disabled: true,
				scale: 'medium',
				handler: function(){
					var answer = confirm ("Are you sure you want to close this dataset?");
					if(answer) { window.location.reload(); }
				}
			},'-',
			{
				text: 'Export PDF',
				id: 'pdfbutton',
				disabled: true,
				iconCls: 'menuPDF',
				scale: 'medium',
				handler: function() {getPDF();}
			},	
			{
				text: 'Export SVG',
				id: 'svgbutton',
				disabled: true,
				iconCls: 'menuSVG',
				scale: 'medium',
				handler: function() {getSVG();}
			},					
			'-',
			//{xtype: 'tbspacer', width: 50},
			{
				xtype: 'button',
				text: 'View',
				iconCls: 'menuView',
				scale: 'medium',
				menu: {
					defaults: {checked: true, align: 'left', handler: hideShowMgr},
					items: [
						{text: "layer panel", panel: 'layerPanel', id: 'layerPanelCheckBox'},
						{text: "data panel", panel: 'dataPanel', id: 'dataPanelCheckBox'},
						{text: "code panel", panel: 'syntaxPanel', id: 'syntaxPanelCheckBox', checked: false}	
					]
				}
			},
			'->',
		/*	{
				xtype: 'combo',
				typeAhead: false,
				mode: 'local',
				height: 30,
				triggerAction: 'all',
				editable: false,
				fieldLabel: 'Computation Server',
				emptyText: 'CPU server',
				//forceSelection: true,
				valueField: 'url',
				displayField: 'displayText',		
				store: new Ext.data.ArrayStore({
					id: 0,
					fields: ['url','displayText'],
					data: [['/R', 'localhost (default)'], ['http://rweb.stat.ucla.edu/R', 'rweb.stat.ucla.edu'], ['http://nicolas.yeroon.net/R', 'nicolas.yeroon.net']],
				}),
				listeners: {'beforeselect': changeCPU}
			},		*/		
			{xtype: 'tbspacer', width: 40},
			'-',
			{
				text: 'Cite',
				iconCls: 'menuCite',
				scale: 'medium',
				handler: function() {showCiteWindow();}
			},'-',	
			{
				text: 'Help / About',
				iconCls: 'menuHelp',
				scale: 'medium',
				handler: function() {window.open('http://www.jeroenooms.com/ggplot2.html');}
			},'-'	
		]
	});	
	

    new Ext.Viewport({
		id: 'viewport',
		bodyStyle: 'background: none',
		layout: 'border',
		cls: 'viewport',
		title: 'Ext Layout Browser',
		items: [{
				id: 'menuBarPanel',
				region: 'north',
				height: 0,
				tbar:mainMenuBar,
				border: false
			},
			dataPanel,
			workspacePanel,
			layerPanel,
			syntaxPanel
		],
        renderTo: Ext.getBody()
    });
	getMenuData();

	Ext.getCmp('workspace').plotConfig = new PlotConfig();
	//Ext.getCmp('syntaxPanel').getEl().on('dblclick',function(){Ext.getCmp('syntaxPanel').collapse()});
	//newLayer();
		
	var citeWindow;	
	function showCiteWindow(){

		if(!citeWindow){
			citeWindow = new Ext.Window({
				closeAction: 'hide',
				iconCls: 'bib',
				title: "Citing lme4",
				closable: true,
				layout: 'fit',
				height: 400,
				width: 700,
				autoScroll: false,
				items:{
					border: false,
					applyTo: 'citeDiv'
				}
			});	
		}
		citeWindow.show();	
	}

	addToTerminal("# Welcome to yeroon.net/ggplot version 0.2!");
	addToTerminal("# To install ggplot2, do: install.packages('ggplot2')");
	addToTerminal("library(ggplot2);");
	setTerminal("ggplot()");
});