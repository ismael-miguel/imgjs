// https://jsfiddle.net/fa5kpz8p/10/
(function(window){
	'use strict';
	
	var document = window.document;
	
	var log_error = function(str){
		/*
			Warning: http://stackoverflow.com/a/690300/2729937
			IE8 only exposes the console AFTER you open the development
				tools (<F12>), and may delete it after closing
			Also, console.error may not be available.
		*/
		if(window.console)
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
        
		//We want real data, and enabling may mess it up
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
		_index: ['none', 'lzw'],
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
				
				return String.fromCharCode.apply(String, lzw);
			},
			decode: function(data) {
				var dict = {};
				var currChar = data[0];
				var oldPhrase = currChar;
				var lzw = [currChar];
				var code = 256;
				var phrase;
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
				.encode(code.toString())
				.replace(/[\xFF-\uFFFF]/g, function(chr){
					var code = chr.charCodeAt(0);
					
					if(code > 255)
					{
						return '\xFF' + String.fromCharCode(code & 255, (code >> 8) & 255);
					}
					else
					{
						return '\xFF\0';
					}
				});
			
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
				imgdata = context.getImageData(0, 0, img.width, img.height);
				
			}
			else if(img.tagName == 'IMG')
			{
				canvas = get_canvas(img.width, img.height);
				if(!canvas) return false;
				context = canvas.context;
				
				context.drawImage(img, 0, 0);
				
				imgdata = context.getImageData(0, 0, img.width, img.height);
			}
			else
			{
				log_error('Invalid image');
				return false;
			}
			
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
                
				data.shift();
			}
			
			
			
			return encoder
				.decode(
					output.replace(/(\xFF..)/g, function(data){
							console.log([data,data.split(''),data.charCodeAt(1),data.charCodeAt(2)]);
							return String.fromCharCode( (data.charCodeAt(2) << 8) | data.charCodeAt(1) );
						}
					)
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
	
	window.CanvasJS = {
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
