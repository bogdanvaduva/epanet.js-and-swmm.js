-- FUNCTION: qgep_od.fn_swmm(character varying, integer)

-- DROP FUNCTION qgep_od.fn_swmm(character varying, integer);

CREATE OR REPLACE FUNCTION qgep_od.fn_swmm(
	var_bbox character varying,
	var_srid integer)
RETURNS TABLE(type character varying, element text) 
    LANGUAGE 'sql'
    COST 100
    VOLATILE 
    ROWS 1000
AS $BODY$SELECT 'JUNCTIONS'::character varying,row_to_json(tmp_junctions)::text
FROM (
	select wn_obj_id as id,wn_bottom_level as elevation,wn_backflow_level as maxdepth,0 as initdepth,0 as surchargedepth,0 as pondedarea,st_astext((ST_Dump(situation_geometry)).geom) as geometry
	from qgep_od.vw_qgep_wastewater_structure as ws
	where ws.ws_type='manhole' and st_intersects(ws.situation_geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2))
) tmp_junctions
UNION
SELECT 'CONDUITS'::character varying,row_to_json(tmp_conduits)::text
FROM (
	select obj_id as id,
		rp_from_fk_wastewater_networkelement as node1,
		rp_to_fk_wastewater_networkelement as node2,
		length_effective as length,
		0.013 as manning,
		rp_from_level as ih,
		rp_to_level as oh,
		0 as if,
		st_astext(ST_CurveToLine(progression_geometry)) as geometry
	from qgep_od.vw_qgep_reach as r
	where st_intersects(ST_CurveToLine(r.progression_geometry),(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2))
) tmp_conduits
;

$BODY$;
