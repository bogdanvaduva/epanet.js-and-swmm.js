epanet.js
=========

JavaScript version of EPANET.
No installation required. Data is not sent to the server.

This is an updated version of the one found at [sdteffen/epanet.js](https://github.com/sdteffen/epanet.js)

To view the original one have a look at :

Demo: [epanet.de/js](http://epanet.de/js/)

Detailed information: [epanet.de/developer/epanetjs.html](http://epanet.de/developer/epanetjs.html)

Requirements
============

[Emscripten](http://emscripten.org)'s emcc c-to-js compiler.

Compilation
===========

A shell like Bash need to be used to build epanet.js. 
1. Download epanet source files from https://www.epa.gov/sites/production/files/2018-10/en2source.zip
2. Unzip the files into the desired folder. I will use for our example /home/test/epanet. Go into /home/test/epanet .
3. Modify the file epanet.c as follows:
.....

/*** New compile directives ***/  //(2.00.11 - LR)

#define CLE     /* Compile as a command line executable */

//#define SOL     /* Compile as a shared object library */

//#define DLL       /* Compile as a Windows DLL */ 


.....

4. Put the content of /js folder into /home/test/epanet.
5. Download shell.html or create a new one that has a similar structure.
6. Run the following command 

emcc -O1 epanet.c hash.c hydraul.c inpfile.c input1.c input2.c input3.c mempool.c output.c quality.c report.c rules.c smatrix.c -o js.html --pre-js js/pre.js  --post-js js/post.js --js-library js/library.js -s EXPORTED_FUNCTIONS="['_main', '_hour']" -s BINARYEN_TRAP_MODE='clamp' -s ERROR_ON_UNDEFINED_SYMBOLS=0 -s TOTAL_MEMORY=16777216 -s ALLOW_MEMORY_GROWTH=1

5. Use it and enjoy!

SAMPLE
======

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/epanet.gif)

TODO
====
If the compilation runs without errors you will have to go into the new generated js.js file and make a few changes:

...
  Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}
.....

become

...
  Module["noExitRuntime"] = true;

//run();





// {{MODULE_ADDITIONS}}
.....


and

.....

,unlink:function (path) {

        var lookup = FS.lookupPath(path, { parent: true });

        var parent = lookup.node;

        var name = PATH.basename(path);

        var node = FS.lookupNode(parent, name);

        var err = FS.mayDelete(parent, name, false);

        if (err) {

.....

become

.....

,unlink:function (path) {

	if (path === "")

		return;

        var lookup = FS.lookupPath(path, { parent: true });

        var parent = lookup.node;

        var name = PATH.basename(path);

        var node = FS.lookupNode(parent, name);

        var err = FS.mayDelete(parent, name, false);

        if (err) {

.....

to change sample.html 

Libraries
=========

epanet.js uses several libraries:

* [Emscripten](http://emscripten.org)
* [D3.js](http://d3js.org)
* [jQuery](http://jquery.com)
* [Bootstrap](http://getbootstrap.com)
* [FileSaver.js](https://github.com/eligrey/FileSaver.js/)
