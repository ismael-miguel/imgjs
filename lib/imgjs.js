/*
	Try on: http://jsfiddle.net/fa5kpz8p/16/
	Example: http://i.imgur.com/PGlFaT1.png
	Code in the image: alert('it runs and works')
*/
(function(window, undefined){
	'use strict';
	
	var document = window.document;
	var console = window.console;
	
	var log_error = function(str){
		/*
			Warning: http://stackoverflow.com/a/690300/2729937
			IE8 only exposes the console AFTER you open the development
				tools (<F12>), and may delete it after closing
			Also, console.error may not be available.
		*/
		if(console)
		{
			(console.error || console.log).call(console, 'CanvasJS: ' + str);
		}
	};

	var get_canvas = function(width, height){
		var canvas = document.createElement('canvas');
		
		// Browsers can create <canvas>, but may not have .getContext()
		if(!canvas.getContext)
		{
			log_error('Canvas support is required');
			return false;
		}
		
		/*
			Warning: http://stackoverflow.com/a/13198764/2729937
			Basically: Firefox may limit the width and height to 8000
				if the size is set after getting the context
		*/
		canvas.width = width;
		canvas.height = height || width;
		
		var context = canvas.getContext('2d');
		
		if(!context)
		{
			log_error('Error creating the 2d context');
			return false;
		}
        
		//We want real data, and enabling smoothing may mess it up
        context.imageSmoothingEnabled = false;
        context.mozImageSmoothingEnabled = false;
        context.webkitImageSmoothingEnabled = false;
        context.msImageSmoothingEnabled = false;
		
		return {
			canvas:canvas,
			context:context
		};
	};
	
	var encoders = {
		_index: ['none', 'lzw', 'shortcode'],
		none: {
			encode: function(data){
				return data;
			},
			decode: function(data){
				return data;
			},
			index: 0
		},
		/*
			Taken from https://gist.github.com/revolunet/843889
			Shamelessly modified it to speed up and to work with this code
		*/
		lzw: {
			encode: function(data) {
				var dict = {};
				var lzw = [];
				var phrase = data[0];
				var currChar = '';
				var code = 256;
				
				for(var i = 1, l = data.length; i < l; i++)
				{
					currChar = data[i];
					if (dict[phrase + currChar] != null)
					{
						phrase += currChar;
					}
					else
					{
						lzw.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
						dict[phrase + currChar] = code;
						code++;
						phrase = currChar;
					}
				}
				
				lzw.push(phrase.length > 1 ? dict[phrase] : phrase.charCodeAt(0));
				
				return String
					.fromCharCode
					.apply(String, lzw)
					//Encodes encoder-specific characters
					.replace(/[\u00FF-\uFFFF]/g, function(codepoint){

						var code = codepoint.charCodeAt(0);

						return '\xFF' + String.fromCharCode(code & 0xFF, (code >> 8) & 0xFF);

					});
			},
			decode: function(data) {
				var dict = {};
				var currChar = data[0];
				var oldPhrase = currChar;
				var lzw = [currChar];
				var code = 256;
				var phrase;
				
				//Decodes the encoder-specific characters
				data = data.replace(/\u00FF([\0-\xFF])([\0-\xFF])/g, function(_, first_char, second_char){
					return String.fromCharCode(
						(second_char.charCodeAt(0) << 8)
						| first_char.charCodeAt(0)
					);
				});
				
				for(var i = 1, l = data.length; i < l; i++)
				{
					var currCode = data.charCodeAt(i);
					
					if (currCode < 256)
					{
						phrase = data[i];
					}
					else
					{
						phrase = dict[currCode] ? dict[currCode] : (oldPhrase + currChar);
					}
					lzw += phrase;
					currChar = phrase[0];
					dict[code] = oldPhrase + currChar;
					code++;
					oldPhrase = phrase;
				}
				return lzw;
			},
			index: 1
		},
		shortcode: {
			encode:function(code){
				var copy = code.toString();
				
				for(var group = 0, groups = this.shortenings.length; group < groups; group++)
				{
					for(var shortening = 0, shortenings = this.shortenings[group].length; shortening < shortenings; shortening++)
					{
						var regex = this.shortenings[group][shortening].replace(/[\[\]\(\)\-\+\^\$]/g,'\\\$&');
						copy = copy.replace(new RegExp(regex, 'g'), function(){
							return '\xFF' + String.fromCharCode(group) + String.fromCharCode(shortening) ;
						});
					}
				}
				
				return copy;
			},
			decode:function(code){
				
				var shortenings = this.shortenings;
				
				return code
					.toString()
					.replace(/\u00FF([\0-\xFF])([\0-\xFF])/g, function(_, first_char, second_char){
						return shortenings[first_char.charCodeAt(0)][second_char.charCodeAt(0)];
					});
			},
			shortenings:[
				['for(var i = 0','for(var i=0',';i++)','for(var k in ',';i< ',';i<'],
				['var i = 0;','var i = 0, ','var i = 0,','var i=0','var i=0;','var i=0,','var i=0','var ']
			],
			index: 2
		}
	};
	
	var methods = {
		get: function(url){
			var obj = this;
			var handlers = {error:[], success:[]};
			
			var img = new Image();
			
			img.crossOrigin = 'Anonymous';
			
			img.onload = function(event){
				obj.run(this);
				for(var i = 0, l = handlers.success.length; i < l; i++)
				{
					try
					{
						handlers.success[i].call(this, event);
					}
					catch(e)
					{
						log_error(e);
					}
				}
			};
			img.onerror = function(event){
				log_error('Failed to load ' + url);
				for(var i = 0, l = handlers.error.length; i < l; i++)
				{
					try
					{
						handlers.error[i].call(this, event);
					}
					catch(e)
					{
						log_error(e);
					}
				}
			};
			
			img.src = url;
			
			return {
				success: function(handler){
					if(handler instanceof Function)
					{
						handlers.success.push(handler);
					}
					return this;
				},
				error: function(handler){
					if(handler instanceof Function)
					{
						handlers.error.push(handler);
					}
					return this;
				}
			};
		},
		encode: function(code, mode, encoder){
			/*
				Copying the string representation to a variable may help with
					issues where we accidentally delete a reference to an object.
				Also, 2 bytes will have the length.
				This requires that we adjust the size calculations
				Note:
					- To avoid weird issues, the maximum width and height
						of single-line modes is limited to 2048 pixels
					- The encoding function comes directly from the calling method
			*/
			var str = encoder
				.encode(
					code
						.toString()
						//Replaces all chars above 253 with 3 bytes, being 254 the identifying byte
						.replace(/[\u00FE-\uFFFF]/g, function(codepoint){

							var code = codepoint.charCodeAt(0);

							return '\xFE' + String.fromCharCode(code & 0xFF, (code >> 8) & 0xFF);

						})
					);
			
			var width = Math.ceil(str.length / 3) + 2;
			var height = 0;
			switch(mode){
				case 'line':
				case 'hline':
					height = Math.ceil(width / 2048);
					break;
				case 'vline':
					//Smallest final file on IE and Chrome
					height = width;
					width = Math.ceil(--width / 2048);
					break;
				default:
					//Prettiest result
					width = height = Math.ceil(Math.sqrt(width));
			}
			
			var canvas = get_canvas(width, height);
			
			if(!canvas) return false;
			
			var imgdata = canvas.context.createImageData(width, height);
			var data = [];
			
			/*
				Store the length as the first pixels, divided by bytes
				WARNING: EVERY 4TH BYTE MUST BE 255 DUE TO PERFORMANCE REASONS
					BROWSERS USE SOME WEIRD ALPHA STUFF THAT CHANGES THE PIXEL DATA
					BASED ON THE ALPHA CHANNEL (4TH BYTE)
			*/
			var data = [
				str.length & 255,
				(str.length >> 8) & 255,
				(str.length >> 16) & 255,
				255,
				(str.length >> 24) & 255,
				encoder.index,
				255,
				255
			];
			
			for(var i = 0, l = str.length; i < l; i += 3)
			{
				data.push(
					str.charCodeAt(i),
					str.charCodeAt(i + 1) || 0,
					str.charCodeAt(i + 2) || 0,
					255
				);
			}
			for(var i = 0, l = data.length; i < l; i++)
			{
				imgdata.data[i] = data[i];
			}

			canvas.context.putImageData(imgdata, 0, 0);
			
			return canvas.canvas;
		},
		decode: function(img){
			var canvas;
			var context;
			var imgdata;
			
			if(img.tagName == 'CANVAS')
			{
				canvas = img;
				context = canvas.getContext('2d');
				
			}
			else if(img.tagName == 'IMG')
			{
				canvas = get_canvas(img.width, img.height);
				if(!canvas) return false;
				context = canvas.context;
				
				context.drawImage(img, 0, 0);
			}
			else
			{
				log_error('Invalid image');
				return false;
			}
			
			imgdata = context.getImageData(0, 0, img.width, img.height);
			
			//Data at index 3, 5, 6 and 7 are just to avoid the alpha problem and for padding
			var length = (imgdata.data[4] << 24)
				| (imgdata.data[2] << 16)
				| (imgdata.data[1] << 8)
				| imgdata.data[0];
			
			if(length < 0)
			{
				log_error('Decoded length is bellow 0 (value: ' + length + ')');
				return false;
			}
			
			var encoder = encoders[encoders._index[imgdata.data[5]]];
			
			if(!encoder)
			{
				log_error('Invalid encoder specified (value: ' + imgdata.data[5] + ')');
				return false;
			}
			
			var output = '';
			
			var data = Array.prototype.slice.call(imgdata.data, 8);
            var i = 0;
			//Checking `i < length` eliminates null chars at the end
			while(data.length && i < length)
			{
				output += String.fromCharCode(data.shift());
                i++;
				
				//I hate repeated code, but this has to be repeated
                if(i < length)
                {
                    output += String.fromCharCode(data.shift());
                    i++;
                }
                if(i < length)
                {
                    output += String.fromCharCode(data.shift());
                    i++;
                }
                
				//Discard alpha channel
				data.shift();
			}
			
			return encoder
				.decode(
					//Attempts to rebuild all chars above 254
					output.replace(/\u00FE([\0-\xFF])([\0-\xFF])/g, function(_, first_char, second_char){
						return String.fromCharCode(
							(second_char.charCodeAt(0) << 8)
							| first_char.charCodeAt(0)
						);
					})
				);
		},
		run: function(img, callback){
			var code = this.decode(img);
			
			//When something goes wrong, it always returns false
			if(code === false)
			{
				return false;
			}
            
            try
            {
				var returned = Function(code)();
                if(callback instanceof Function)
                {
                    callback.call('object' == typeof returned ? returned : window, returned);
                }
            }
            catch(e)
            {
                log_error(e);
            }
            
		}
	};
	
	window.IMGJS = {
		get: function(url){
			if(!url)
			{
				return false;
			}
			
			return methods.get(url);
		},
		encode: function(code, mode, encoder){
			return methods.encode(code, mode || 'square', encoders[encoder] || encoders.none);
		},
		decode: function(img){
			return methods.decode(img);
		},
		run: function(img, callback){
			return methods.run(img, callback);
		},
		getEncoders:function(){
			return encoders._index;
		}
	};
	
})(Function('return this')());
