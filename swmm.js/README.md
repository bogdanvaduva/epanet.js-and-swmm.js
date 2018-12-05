swmm.js
=========

JavaScript version of SWMM 5.
No installation required. Data is not sent to the server.

This is built following the lines found at [sdteffen/epanet.js](https://github.com/sdteffen/epanet.js)

To view the original one have a look at :

Demo: [epanet.de/js](http://epanet.de/js/)

Detailed information: [epanet.de/developer/epanetjs.html](http://epanet.de/developer/epanetjs.html)

Requirements
============

[Emscripten](http://emscripten.org)'s emcc c-to-js compiler.

Compilation
===========

A shell like Bash need to be used to build epanet.js. 
1. Download epanet source files from https://www.epa.gov/sites/production/files/2018-08/swmm51013_engine_0.zip
2. Unzip the files into the desired folder. I will use for our example /home/test/swmm. Go into /home/test/swmm .
3. If you use the source code found at https://github.com/CHIWater/OpenSWMM/releases/tag/v5.1.12, then modify the file swmm5.c as follows:
.....

/*** New compile directives ***/  //(2.00.11 - LR)

#define CLE     /* Compile as a command line executable */

//#define SOL     /* Compile as a shared object library */

//#define DLL       /* Compile as a Windows DLL */ 


.....

4. Put the content of /js folder into /home/test/swmm.
5. Download shell.html or create a new one that has a similar structure.
6. Run the following command 

emcc -O1 swmm5.c climate.c controls.c culvert.c datetime.c dwflow.c dynwave.c error.c exfil.c findroot.c flowrout.c forcmain.c gage.c gwater.c hash.c hotstart.c iface.c infil.c inflow.c input.c inputrpt.c keywords.c kinwave.c landuse.c lid.c lidproc.c link.c main.c massbal.c mathexpr.c mempool.c node.c odesolve.c output.c project.c qualrout.c rain.c rdii.c report.c roadway.c routing.c runoff.c shape.c snow.c stats.c statsrpt.c subcatch.c surfqual.c table.c toposort.c transect.c treatmnt.c xsect.c -o js.html -s EXPORTED_FUNCTIONS="['_main', '_time', '_link']" -s BINARYEN_TRAP_MODE='clamp' -s ASSERTIONS=0

5. Use it and enjoy!

SAMPLE
======

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/swmm.gif)

TODO
====
to modify the generated js.js to deal with null nodes.
to change sample.html 

Libraries
=========

epanet.js uses several libraries:

* [Emscripten](http://emscripten.org)
* [D3.js](http://d3js.org)
* [jQuery](http://jquery.com)
* [Bootstrap](http://getbootstrap.com)
* [FileSaver.js](https://github.com/eligrey/FileSaver.js/)
