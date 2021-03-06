epanet.js and swmm.js
=====================

JavaScript version of EPANET and SWMM. No installation will be required. Data will not be sent to the server.

This is an updated version of the one found at [sdteffen/epanet.js](https://github.com/sdteffen/epanet.js) ( Great job done there! )

To view the original one have a look at :

Demo: [epanet.de/js](http://epanet.de/js/)

Detailed information: [epanet.de/developer/epanetjs.html](http://epanet.de/developer/epanetjs.html)

Requirements
============

[Emscripten](http://emscripten.org)'s emcc c-to-js compiler.

Compilation for epanet.js
=========================

Check [epanet.js](/epanet.js)

NOTE: After running emcc command, the resulted file js.js will not deal with null nodes in FS, so YOU will have to make some changes there. 
====

Compilation for swmm.js
=========================

Check [swmm.js](/swmm.js)


SAMPLE FOR EPANET.js
====================

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/epanet.gif)

SAMPLE FOR SWMM.js
====================

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/swmm.gif)

TODO
====

to change sample.html 


Libraries
=========

epanet.js uses several libraries:

* [Emscripten](http://emscripten.org)
* [D3.js](http://d3js.org)
* [jQuery](http://jquery.com)
* [Bootstrap](http://getbootstrap.com)
* [FileSaver.js](https://github.com/eligrey/FileSaver.js/)

DATA MODEL
==========

I am using QWAT and QGEP data model ( Great job! )

In order to be able to export data from QWAT to EPANET we need to know if the water is flowing from one point (node) to another. I am using pgRouting and a few functions wrote by myself.

We know that pgRouting extends the PostGIS / PostgreSQL geospatial database to provide
geospatial routing functionality. On the other hand we know that QWAT models the water network.
In this model we have pipes and we have nodes. In order to find the water flow in QWAT we need
to have edges (pipes), start node and end node. The good thing about model is that it already defines
node A and node B for a pipe.

In my environment I am spliting the pipes only when two or more pipes meet. The 'meeting pipes' will have not to have the
function "branchement privé". In the following picture there is an example of how my
network is laid out:

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/fig1.png)

The network layout is not suitable for pgRouting algorithms because we don’t have an edge
with start point node 1 and end point node 2 or start point node 1 and end point node 3 or start point
node 2 and end point node 3.
To make QWAT pgRouting friendly we added a new table called pipe_reference with the
following structure:

CREATE TABLE qwat_od.pipe_reference

(

id serial NOT NULL,

fk_pipe integer,

fk_node_a integer,

fk_node_b integer,

geometry geometry,

CONSTRAINT pipe_reference_pkey PRIMARY KEY (id),

CONSTRAINT pipe_reference_fk_pipe_fkey FOREIGN KEY (fk_pipe)

REFERENCES qwat_od.pipe (id) MATCH SIMPLE

ON UPDATE NO ACTION ON DELETE CASCADE

)

WITH (

OIDS=FALSE

);


The second step was to create a function which splits a pipe according to my network
layout:


CREATE OR REPLACE FUNCTION qwat_od.fn_pipe_(var_pipe_id integer)

RETURNS integer AS

$BODY$DECLARE r record;

DECLARE fk integer;

DECLARE g1 geometry;

DECLARE ml record;

BEGIN

DELETE FROM qwat_od.pipe_reference WHERE fk_pipe=var_pipe_id;

FOR r IN (

SELECT *, 
CASE WHEN ST_LineLocatePoint(tblpipe.pg,tblpipe.fk_ag)<ST_LineLocatePoint(tblpipe.pg, tblpipe_nodes.ng) THEN
ST_Length(ST_LineSubstring(tblpipe.pg, ST_LineLocatePoint(tblpipe.pg,tblpipe.fk_ag), ST_LineLocatePoint(tblpipe.pg, tblpipe_nodes.ng))) ELSE 99999
END as distance

FROM (

SELECT vw_pipe.id as pid,n.id as fk_a,vw_pipe.fk_node_b as

fk_b,n.geometry as fk_ag,vw_pipe.geometry as pg

FROM qwat_od.vw_pipe join qwat_od.node as n on n.id=vw_pipe.fk_node_a

WHERE vw_pipe.id=var_pipe_id

) tblpipe join (

SELECT vw_pipe.id as p_id,n.id as n,n.geometry as ng

FROM qwat_od.vw_pipe join qwat_od.node as n on n.id not in (vw_pipe.fk_node_a,vw_pipe.fk_node_b)

WHERE vw_pipe.id=var_pipe_id and

ST_Distance(n.geometry,vw_pipe.geometry)>=0 and ST_Distance(n.geometry,vw_pipe.geometry)<0.003 
and n.id in (select pipe.fk_node_a from qwat_od.pipe union select pipe.fk_node_b from qwat_od.pipe)

) tblpipe_nodes on tblpipe.pid=tblpipe_nodes.p_id

ORDER BY distance

)

LOOP

IF (fk IS NULL) THEN

fk = r.fk_a;

END IF;

IF (g1 IS NULL) THEN

g1 = r.pg;

END IF;

-- split line by nodes ST_Distance(g1,r.ng)*1.5
SELECT
ST_NumGeometries(ST_CollectionExtract(ST_Split(ST_Snap(g1,r.ng,0.003),r.ng),2
)) as nr,

ST_GeometryN(ST_CollectionExtract(ST_Split(ST_Snap(g1,r.ng,0.003),r.ng),2),1)
as l1,

ST_GeometryN(ST_CollectionExtract(ST_Split(ST_Snap(g1,r.ng,0.003),r.ng),2),2)
as l2 INTO ml;

-- insert line into pipe_reference
INSERT INTO
qwat_od.pipe_reference(fk_pipe,fk_node_a,fk_node_b,geometry)
SELECT r.pid,fk,r.n,ml.l1;

fk = r.n;

g1 = ml.l2;

END LOOP;

IF (r IS NOT NULL) THEN

INSERT INTO
qwat_od.pipe_reference(fk_pipe,fk_node_a,fk_node_b,geometry)
SELECT r.pid,fk,r.fk_b,g1;

END IF;

RETURN 0;

END;$BODY$

LANGUAGE plpgsql VOLATILE

COST 100;

After running the previous function on my network I got edges for node1-node2, node2-
node3 … and so one. You can see in figure2 the ids (green numbers) on my pipes.

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/fig2.png)

The third step was to install the pgRouting extension.
The fourth step was to create a function to determine the path between two nodes.

CREATE OR REPLACE FUNCTION qwat_od.fn_pipe_path(IN var_nod_a integer,
IN var_nod_b integer)

RETURNS TABLE(seq integer, path_seq integer, nod bigint, edge bigint, cost
double precision, agg_cost double precision, geometry geometry, path text) AS

$BODY$

SELECT path.*,geom.geometry,geom.json FROM pgr_dijkstra('

select id,
fk_node_a as source,
fk_node_b as target,

CASE WHEN qwat_od.ft_element_valve_status(id) THEN -1 ELSE
st_length(vw_pipe.geometry) END as cost,

CASE WHEN qwat_od.ft_element_valve_status(id) THEN -1 ELSE
st_length(vw_pipe.geometry) END as reverse_cost

from qwat_od.vw_pipe

union

select sp.fk_pipe,
sp.fk_node_a,
sp.fk_node_b,

CASE WHEN sp.geometry is not null THEN CASE WHEN
qwat_od.ft_element_valve_status(sp.fk_pipe) THEN -1 ELSE
st_length(sp.geometry) END ELSE 0.1 END,

CASE WHEN sp.geometry is not null THEN CASE WHEN
qwat_od.ft_element_valve_status(sp.fk_pipe) THEN -1 ELSE
st_length(sp.geometry) END ELSE 0.1 END

from qwat_od.pipe_reference as sp',var_nod_a,var_nod_b) as path

LEFT JOIN (

SELECT id,geometry,ST_AsGeoJSON(geometry) as json
FROM qwat_od.pipe

) as geom ON geom.id=path.edge

$BODY$

LANGUAGE sql VOLATILE

COST 100

ROWS 1000;

The fifth step was to run the function.
In Figure 3 we have the result of running the function on my network between two points.

![Example of how it's used in an application](https://github.com/bogdanvaduva/epanet.js-and-swmm.js/blob/master/fig3.gif)

The sixth step was to add a function to determine valve status:

CREATE OR REPLACE FUNCTION

qwat_od.fn_element_valve_status(var_pipe_id integer)
RETURNS boolean AS

$BODY$

SELECT bool_or(closed) as closed

FROM qwat_od.vw_element_valve

WHERE fk_pipe=var_pipe_id

GROUP by fk_pipe

$BODY$

LANGUAGE sql VOLATILE

COST 100;

The last step required by epanet.js is to pass the results of the function found in [/sql/qwat_od/fn_epanet.sql](./sql/qwat_od/fn_epanet.sql) to the epanet.html and view the result.

Regarding QGEP the problem is a little bit easier, because we already know node a and node b, but you will still have to pass the results of the function found in [/sql/qgep_od/fn_swmm.sql](./sql/qgep_od/fn_swmm.sql) to swmm.html and then view the results. 

