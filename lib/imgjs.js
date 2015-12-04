/*
	Try on: http://jsfiddle.net/fa5kpz8p/21/
	Example: http://i.imgur.com/PGlFaT1.png
	Real-world example:
		Library: jQuery 2.1.4 (minified)
		Image: http://i.imgur.com/7NXiBPP.png
		Link: http://imgur.com/7NXiBPP
		Encoder: shortcode
		Options: {minimify:true}
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
		_index: ['none', 'minimify', 'shortcode', 'shortcode2'],
		none: {
			encode: function(data){
				return data;
			},
			decode: function(data){
				return data;
			},
			index: 0
		},
		minimify:{
			encode: function(data, options){
				var copy = data
					.toString()
					/*
						Normalizes EOL into Linux EOL (\n), may save bytes
						Doing such cleanup will help later on
					*/
					.replace(/\r\n?/g, '\n');
				
				if(options.comments)
				{
					copy = copy
						//Removes single-line comments starting after a newline
						.replace(/\n\s*\/\/.*/g, '')
						//Same procedure, for multi-line
						.replace(/\n\s*\/\*(?:[^\*]|\*[^\/])*\*\/\s*/g, '\n');
				}
				
				if(options.whitespace)
				{
					copy = copy
						//Removes needless whitespace at the beginning of the line
						.replace(/\n\s+/g, '\n')
						//Removes needless whitespace at the beginning or end
						.replace(/(?:^\s+|\s+$)/g, '');
				}
				
				if(options.unsafe)
				{
					copy = copy
						//Removes any repeated whitespace
						.replace(/(\s)\s+/g, '$1')
						//Removes whatever looks like a comment, somewhere
						.replace(/\s*([\)\;\,\|=\.\]])\s*\/\/.*/, '$1') //--> single-line
						.replace(/\s*\/\*(?:[^\*]|\*[^\/])*\*\/\s*/g, '') //--> multi-line
						//Unsafely remove all whitespace before SOME special chars
						.replace(/\s+([\)\;\,\|=\.\]])/g, '$1')
						//... and after SOME special characters
						.replace(/([\[\(\;\,\|=\.])\s+/g, '$1');
				}
				
				return copy;
			},
			decode: function(data){
				return data;
			},
			index: 1
		},
		shortcode: {
			encode:function(code, options){
				var copy = code.toString();
				
				if(options.minimify)
				{
					copy = encoders
						.minimify
						.encode(
							copy,
							options.options ||
								{
									comments: true,
									whitespace: true,
									unsafe: false
								}
						);
				}
				
				for(var shortening = 0, shortenings = this.shortenings.length; shortening < shortenings; shortening++)
				{
					var regex = this.shortenings[shortening].replace(/[\[\]\(\)\-\+\^\$\.]/g,'\\\$&');
					copy = copy.replace(new RegExp(regex, 'g'), function(){
						return '\xFF' + String.fromCharCode(shortening) ;
					});
				}
				
				return copy;
			},
			decode:function(code){
				
				var shortenings = this.shortenings;
				
				return code
					.toString()
					.replace(/\u00FF([\0-\xFF])/g, function(_, char_byte){
						return shortenings[char_byte.charCodeAt(0)];
					});
			},
			shortenings:[
				//count: 5
				'for(var i = 0','for(var i=0',';i++)','for(var k in ',';i < ',';i<',
				//count: 8
				'var i = 0;','var i = 0, ','var i = 0,','var i=0','var i=0;','var i=0,','var i=0','var ',
				//count: 10
				'document.getElementsByTagName(', 'document.getElementsByClassName(', 'document.getElementsByName(', 'document.createElement(', 'document.createTextNode(', 'document.location', 'document.createDocumentFragment(', 'document.querySelectorAll(', 'document.querySelector(', 'document.',
				//count: 7
				'Function(\'return this\')()', 'function(){}', 'function(){', 'Function(', 'new Function(', 'function(e', 'function('
				//count: 
			],
			index: 2
		},
		shortcode2: {
			encode:function(code, options){
				var copy = code.toString();
				
				for(var group = 0, groups = this.shortenings.length; group < groups; group++)
				{
					for(var shortening = 0, shortenings = this.shortenings[group].length; shortening < shortenings; shortening++)
					{
						var regex = this.shortenings[group][shortening].replace(/[\[\]\(\)\-\+\^\$\.]/g,'\\\$&');
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
			index: 3
		}
	};
	
	var methods = {
		get: function(url){
			//Don't make confusion with window.self
			var self = this;
			
			var img = new Image();
			
			var handlers = {
				error: [], //Error to download
				broken: [], //SyntaxError when executing the code
				success: [], //Everything went fine
				status: 'wait',
				running: false,
				event: null,
				run: function(){
					this.running = true;
					
					while(this[this.status].length)
					{
						var handler = this[this.status].shift();
						try
						{
							handler.call(img, handlers.event);
						}
						catch(e)
						{
							log_error(e);
						}
					}
					
					this.running = false;
				},
				add: function(type, handler){
					handlers.success.push(handler);
					
					if(!this.running && this.status != 'wait')
					{
						this.run();
					}
				}
			};
			
			img.crossOrigin = 'Anonymous';
			
			img.onload = function(event){
				handlers.event = event;
				
				try
				{
					self.run(this);
					handlers.status = 'success';
				}
				catch(e)
				{
					handlers.status = 'broken';
					log_error(e);
				}
				
				handlers.run();
			};
			img.onerror = function(event){
				log_error('Failed to load ' + url);
				
				handlers.event = event;
				handlers.status = 'error';
				handlers.run();
			};
			
			img.src = url;
			
			return {
				success: function(handler){
					if(handler instanceof Function)
					{
						handlers.add('success', handler);
					}
					return this;
				},
				error: function(handler){
					if(handler instanceof Function)
					{
						handlers.add('success', handler);
					}
					return this;
				},
				broken: function(handler){
					if(handler instanceof Function)
					{
						handlers.add('broken', handler);
					}
					return this;
				}
			};
		},
		encode: function(code, mode, encoder, options){
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

						}),
					options
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
				WARNING:
					- EVERY 4TH BYTE MUST BE 255 DUE TO PERFORMANCE REASONS
						BROWSERS USE SOME WEIRD ALPHA STUFF THAT CHANGES THE PIXEL DATA
						BASED ON THE ALPHA CHANNEL (4TH BYTE)
					- The 5th byte stores the encoder index used
					- The 6th byte is free for future use
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
		encode: function(code, mode, encoder, options){
			return methods.encode(code, mode || 'square', encoders[encoder] || encoders.none, options || {});
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
