/*
	Try on: https://jsfiddle.net/55fhpbns/14/
	More examples: http://jsfiddle.net/fa5kpz8p/28/
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
			(console.error || console.log).call(console, 'IMGJS: ' + str);
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
			isCompatible: function(version){
				return true;
			},
			index: 0,
			version: 1
		},
		minimify:{
			encode: function(data, options){
				var copy = data
					.toString()
					/*
						Normalizes EOL into Linux EOL (\n), may save bytes
						Doing such cleanup will help later on
					*/
					.replace(/\r\n?/g, '\n')
					//Converts any 2-4 space set into a tab
					.replace(/ {2,4}/g,'\t');
				
				var is_enabled = function(option){
					return (options.all && !(option in options)) || options[option];
				}
				
				if(is_enabled('comments'))
				{
					copy = copy
						//Removes single-line comments starting after a newline
						.replace(/(?:\n|^)\s*\/\/.*/g, '')
						//Same procedure, for multi-line
						.replace(/(?:\n|^)\s*\/\*(?:[^\*]|\*[^\/])*\*\/(?:\s*|$)/g, '\n');
				}
				
				if(is_enabled('whitespace'))
				{
					copy = copy
						//Removes needless whitespace at the beginning of the line
						.replace(/\n\s+/g, '\n')
						//Removes needless whitespace at the beginning or end
						.replace(/(?:^\s+|\s+$)/g, '');
				}
				
				if(is_enabled('unsafe'))
				{
					//if(is_enabled('comments'))
					//{
					//	copy = copy
					//		//Removes whatever looks like a comment, somewhere
					//		.replace(/\s*([\)\;\,\|=\.\]])\s*\/\/.*/, '$1') //--> single-line
					//		.replace(/\s*\/\*(?:[^\*]|\*[^\/])*\*\/\s*/g, ''); //--> multi-line
					//}
					
					if(is_enabled('whitespace'))
					{
						copy = copy
							//Removes any repeated whitespace
							.replace(/(\s)\1+/g, '$1')
							//Unsafely remove all whitespace around special chars
							.replace(/[ \t]*([+-/*%&|!.'"?:=<>;,\{\[\(\)\]\}])[ \t]*/g, '$1')
							//Removes needless whitespace on blocks
							.replace(/(for|while|if|else|catch)\s+\(\s+/g, '$1(')
							.replace(/(else|try|finally|=)\s+{\s+/g, '$1{');
					}
					
					if(is_enabled('parse_escapes'))
					{
						//NOT safe for jQuery 2.1.4
						copy = copy
							//Converts hexadecimal -> decimal
							.replace(/0x([\dA-F]+)/gi, function(hex){
								return parseInt(hex, 16);
							})
							//Converts binary -> decimal
							.replace(/0b([01]+)/gi, function(bin){
								return parseInt(bin, 2);
							})
							//Converts octal -> decimal
							.replace(/0o([0-8]+)/gi, function(oct){
								return parseInt(oct, 8);
							})
							//Next one, breaks jQuery
							//Hexadecimal escape -> character
							/*
							Removed because \uFFFF\xA0 is bugging
							
							.replace(/\\x([\dA-F]{2})|\\u([\dA-F]{4})/gi, function(_, hex, unicode){
								return String.fromCharCode(parseInt(hex || unicode, 16));
							});
							*/
					}
					
					if(is_enabled('parse_entities'))
					{
						//Safe for jQuery 2.1.4
						var textarea = document.createElement('textarea');
						textarea.innerHTML = copy;
						
						copy = textarea.textContent || textarea.innerText;
					}
					
					if(is_enabled('reduce_booleans'))
					{
						//Safe for jQuery 2.1.4
						copy = copy
							//Hexadecimal escape -> character
							.replace(/true|false/g, function(val){
								return '!' + (+(val.toLowerCase() === 'false'));
							});
					}
					if(is_enabled('eval_constants'))
					{
						//Safe for jQuery 2.1.4
						copy = copy
							//.replace(/\s*((?:\d+(?:\.\d*)?|"(?:\\"|[^"])*"|'(?:\\'|[^'])*'^)(?:\s*[+\-*\/%&<>=!]\s*(?:\d+(?:\.\d*)?|"(?:\\"|[^"])*"|'(?:\\'|[^'])*'))+)\s*/gi, function(_){
							.replace(/\s*(\d+(?:\.\d+)?(?:\s*(?:[+\-*\/%]|>[>=]|<[<=]|&&?|!?(?:==?)?|\|\|?)\s*\d+(?:\.\d+)?)+)\s*/g, function(_){
								try
								{
									return Function('return ' + _)();
								}
								catch(e)
								{
									return _;
								}
							});
					}
					
				}
				
				if(options.license)
				{
					copy = option.license.toString() + copy;
				}
				
				return copy;
			},
			decode: function(data){
				return data;
			},
			isCompatible: function(version){
				return true;
			},
			index: 1,
			version: 7
		},
		shortcode: {
			encode:function(code, options){
				var copy = code.toString();
				
				if(copy.length < 3)
				{
					return copy;
				}
				
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
				
				for(var regex = 0, regexes = this.regex.length; regex < regexes; regex++)
				{
					copy = copy.replace(this.regex[regex], function(){
						return '\xFF' + String.fromCharCode(regex) ;
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
				'for(var i = 0', 'for(var i=0', ';i++)', 'for(var k in ', ';i < ', ';i<',
				//count: 8
				'var i = 0;', 'var i = 0, ', 'var i = 0,', 'var i=0', 'var i=0;', 'var i=0,', 'var i=0', 'var ',
				//count: 10
				'document.getElementsByTagName(', 'document.getElementsByClassName(', 'document.getElementsByName(', 'document.createElement(', 'document.createTextNode(', 'document.location', 'document.createDocumentFragment(', 'document.querySelectorAll(', 'document.querySelector(', 'document.',
				//count: 7
				'Function(\'return this\')()', 'function(){}', 'function(){', 'Function(', 'new Function(', 'function(e', 'function(',
				//count: 5
				'for(var j = 0', 'for(var j=0', ';j++)', ';j < ', ';j<',
				//count: 7 + 7 + 2 + 4
				'while(true){', 'while(true) {', 'while (true) {', 'while (true)', 'while (1)', 'while(true)', 'while(1)',
				'while(false){', 'while(false) {', 'while (false) {', 'while (false)', 'while (0)', 'while(false)', 'while(0)',
				'while(', 'while (',
				'do{}', 'do {}','do {', 'do{',
				//count: 8
				'switch ', 'switch', 'case ', 'case','default: break;','default:break;', 'break;', 'default:',
				//count: 4 + 8 + 4 + 1
				'try {', 'try ', 'try{', 'try',
				'catch(e){}', 'catch(e){', 'catch(', 'catch (e){}', 'catch (e){', 'catch (', 'catch (e) {}', 'catch (e) {',
				'finally {', 'finally ', 'finally{', 'finally',
				'e if e instanceof ',
				//count: 8 + 4
				'throw new Error(', 'throw new EvalError(', 'throw new InternalError(', 'throw new RangeError(', 'throw new ReferenceError(', 'throw new SyntaxError(', 'throw new TypeError(', 'throw new URIError(',
				'throw new ', 'throw ', 'throw', 'Error.prototype',
				//count: 2 + 5 + 12
				'Array.prototype.slice.call(arguments)', 'Array.prototype.slice.call(arguments',
				'arguments.callee', 'arguments.caller', 'arguments.length', 'arguments[', 'arguments',
				'undefined', 'null', 'true', 'false', 'Infinity', 'NaN', 'void 0', 'void', 'this.', 'this', 'self.', 'self',
				//count: 17
				'prototype', '.toLocaleString()', '.toLocaleString(', '.toString()', '.toString(', 'toString:', 'toString :', 'constructor', 'init', '.valueOf(', 'valueOf:', 'valueOf :', '.hasOwnProperty(', '.isPrototypeOf(', 'length', '.defineProperty(', '.getOwnPropertyNames(',
				//count: 7
				'delete ', 'new ', 'instanceof ', 'typeof ', 'return;', 'return ', 'return',
				//count: 9 + 8
				'Array(', 'Array.', 'Date(', 'Date.', 'Object(', 'Object.', 'Boolean(', 'RegExp(', 'RegExp.',
				'EvalError(', 'InternalError(', 'RangeError(', 'ReferenceError(', 'SyntaxError(', 'TypeError(', 'URIError(', 'Error(',
				//count: 3
				'\'use strict\';', '"use strict";', 'debugger;',
				//count: 12
				'"string"', '\'string\'', '"object"', '\'object\'', '"number"', '\'number\'', '"boolean"', '\'boolean\'', '"function"', '\'function\'', '"symbol"', '\'symbol\'',
				
				//total: 173
				
				//count: 16 + 4 + 8 + 9
				'Top', 'Left', 'Width', 'Height', 'ElementsBy', 'Element', 'Attribute', 'attribute', 'Node', 'Name', 'name', 'Sibling', 'Child', 'Class', 'Rect', 'scroll',
 				'Offset', 'offset', 'inner', 'outer',
				'Client', 'client', 'first', 'last', 'next', 'previous', 'parent', 'children',
				'style', 'class', 'textContent', 'title', 'dataset', 'contentEditable', 'classList', 'querySelector', 'getComputedStyle',

				//count: 4 + 4
				'screen', 'page', 'window.', 'window',
				'Timeout', 'Interval', 'Event', 'Listener',
				
				//count: 11
				'has', 'get', 'set', 'add', 'clear', 'remove', 'replace', 'append', 'move', 'resize', 'dispatch'
				
				//count: 
				//,'XMLHttpRequest', 'ActiveXObject', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'clear', 'window.',
				
			],
			regex: null,
			setup: function(){
				var shortenings = this.shortenings.length;
				
				this.regex = new Array(shortenings);
				
				for(var shortening = 0; shortening < shortenings; shortening++)
				{
					var regex = this.shortenings[shortening].replace(/[\[\]\(\)\-\+\^\$\.]/g,'\\\$&');
					this.regex[shortening] = new RegExp(regex, 'g');
				}
			},
			isCompatible: function(version){
				return version <= this.version;
			},
			index: 2,
			version: 6
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
			isCompatible: function(version){
				return version <= this.version;
			},
			index: 3,
			version: 1
		}
	};
	
	//Executes the setup methods, if they exist
	for(var i=0, l=encoders._index.length; i < l; i++)
	{
		if(encoders[encoders._index[i]].setup)
		{
			encoders[encoders._index[i]].setup();
		}
	}
	
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
			var length = Math.ceil(str.length / 3) + 2;
			var width = 0;
			var height = 0;
			switch(mode){
				case 'line':
				case 'hline':
					width = length > 2048? 2048 : length;
					height = Math.ceil(length / width);
					break;
				case 'vline':
					//Smallest final file on IE and Chrome
					height = length > 2048? 2048 : length;
					width = Math.ceil(length / height);
					break;
				case 'optimal':
					var sizes = [1]; //all numbers are divisible by 1
					for(var i = 2, l = ((length / 2) + 1) | 0; i < l; i++)
					{
						if(!(length%i))
						{
							sizes[sizes.length] = i;
						}
					}
					var size = sizes.length >> 1;
					width = sizes[size];
					height = length / width;
					if(height > width)
					{
						height = sizes[size];
						width = length / height;
					}
					break;
				default:
					//Prettiest result
					width = height = Math.ceil(Math.sqrt(length));
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
						Format: (encoder.version << 4) | encoder.index
					- version.subversion * 10 (0-255)
			*/
			var data = [
				str.length & 255,
				(str.length >> 8) & 255,
				(str.length >> 16) & 255,
				255,
				(str.length >> 24) & 255,
				(encoder.version << 4) | encoder.index,
				(methods.version * 10) & 255,
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
			
			var max_length = (imgdata.data.length - 8) * 0.75;
			//If the decoded length is superior to 75% of the length minus the 8 initial colors
			if(length > max_length)
			{
				log_error('Decoded length is too high (value: ' + length + ', max: ' + max_length + ')');
				return false;
			}
			
			//Encoder stored as: (encoder.version << 4) | encoder.index
			var decoder_index = imgdata.data[5] & 15; //(15 = 0b1111 = 4 bits)
			var decoder_version = (imgdata.data[5] >> 4) & 255;
			
			var encoder = encoders[encoders._index[decoder_index]];
			
			if(!encoder)
			{
				log_error('Invalid encoder specified (value: ' + decoder_index + ')');
				return false;
			}
			
			if(!encoder.isCompatible(decoder_version))
			{
				log_error('Image created for an incompatible version of the encoder "' + encoders._index[decoder_index] + ' (current: ' + encoder.version + ', created with: ' + decoder_version + ')"');
				return false;
			}
			
			var data = Array.prototype.slice.call(imgdata.data, 8);
			var output = [];
			//Stores these for performance reasons. Shaves 100ms!!!
			var push = output.push;
			var splice = data.splice;

			while(data.length && (output.length < length))
			{
				var spliced = splice.call(data, 0, 4);
				//Ignore the 4th element, only pushes 3
				push.call(output, spliced[0], spliced[1], spliced[2]);
			}

			//Removes unnecessary data
			if(output.length > length)
			{
				output.length = length;
			}
			
			
			return encoder
				.decode(
					//Attempts to rebuild all chars above 254
					String
						.fromCharCode
						.apply(String, output)
						.replace(/\u00FE([\0-\xFF])([\0-\xFF])/g, function(_, first_char, second_char){
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
			
		},
		version: 0.7
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
		},
		version: methods.version
	};
	
})(Function('return this')());
