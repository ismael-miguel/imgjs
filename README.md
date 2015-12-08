# imgjs
## Load your code from a tiny image

------------------------------------------

The idea came from a few articles I read about using `<canvas>` to load images, saying that it reduces the size and increases speed.

That is exactly what I'm aiming to!

It features a basic API to load and encode images.

Lets check it!

## Methods:

 - `get(url)` - Allows to load messages and add the following event handlers:
     - `.success(fn)` - Runs when the code is loaded successfully and executed without any problem
     - `.error(fn)` - Runs when an error occurs to obtain the image
     - `.broken(fn)` - Runs when something goes wrong with the code execution (`SyntaxError`, `invalid length` and so on)
 - `run(img, fn)` - Executes the code inside the `img` (may be a `<canvas>` or an `<img>`), and the `fn` on success;
 - `encode(code, mode, encoder, options)` - Encodes the code into a `<canvas>`, returning also the context. Expected values, per parameter:
     - `code` - A simple string with everything to encode
     - `mode` - How the image will be rendered (square or line). Values:
         - `square` (default) - Produces a perfect quare
         - `vline` - Creates a vertical image (but produces lots of wasted pixels)
         - `line` / `hline` - Create an horizontal line (and smallest file size, sometimes)
         - `optimal` - Creates an optimally-sized image, to avoid wasting pixels. Chooses horizontal lines over vertical lines to reduce the size even more.
     - `encoder` - Accepts any value returned by `.getEncoders()`. Current values:
         - `none` - Pure plaintext, untouched
         - `minimify` - Reduces the size of the code, producing an almost-unreadable version. Options:
             - `all` - Enables all options, unless explicitly disabled
             - `all_unsafe` - Enables all unsafe options, unless explicitly disabled ones
             - `comments` - Indicates to all comments that are safe to remove
             - `whitespace` - Indicates to clean all whitespaces that are safe to delete
             - `unsafe` - **REALLY** eager and agressive reduction. **MAY CAUSE SYNTAX ERRORS!!!**
                 - `parse_escapes` - Parses escape sequences (like `\x5B`) and alternative numerical representations (`0xFF > 255`)
                 - `parse_entities` - Tries to parse HTML entities, like `&euro;`
                 - `reduce_booleans` - Converts every `true` and `false` into `!0` and `!1`, respectivelly
                 - `eval_constants` - Runs **basic** mathematical expressions and some logical expressions (e.g.: `5*6 > 36`)
         - `shortcode` - Uses 1-byte compression with a static dictionary, to reduce greatly the size. Options:
             - `minimify` - Accepts a boolean value. Runs the code through `minimify` before storing
             - `options` - Options used by `minimify`
         - `shortcode2` - More complex, requiring 2 bytes to compress the values. This can reduce almost 4x more than `shortcode`.
     - `options` - Passes options to the encoders
 - `decode(img)` - Accepts a simple `<canvas>` or `<img>`, returning the decoded content from the image
 - `getEncoders()` - Returns an array with the list of all the available encoders

## Recommendations:

 - Pass your own canvas, instead of an image.
 - If you are using an external server, check for the header `Access-Control-Allow-Origin: *` (imgur allows CORS)
 - Also, for images on external servers, avoid using the `.run()` method. Prefer the `.get()`, since it has better error handling
 - If speed to decode is more important that size, use the `shortcode` encoder, with `{minimify: true}`. It passes `{comments: true, whitespace: true}` by default.
 - Avoid images beyound 200x200, or code beyound 100kb.
 - If you are going to encode less than 200 bytes, it isn't worth it. Try to assemble a few files together before.

## Examples of usage:

Using jQuery 2.1.4 (minified):

	IMGJS
		//load jQuery
		.get('http://i.imgur.com/7NXiBPP.png')
		.success(function(){
			console.log([this, arguments]);
		})
		.success(function(){
			//shows the version
			alert($.fn.jquery);
		});

Encoding a piece of code (default settings):

	IMGJS.encode('alert("Hello, world!");');

Decoding an image:

	IMGSRC.decode(document.getElementById('foo'));

Advanced encoding (`shortcode` + `minimify`, `hline`)

	IMGJS.encode('alert("Hello, world!");', 'hline', 'shortcode', {minimify: true});
