DROP FUNCTION qwat_od.ft_epanet(character varying, integer, character varying);

CREATE OR REPLACE FUNCTION qwat_od.ft_epanet(
	var_bbox character varying,
	var_srid integer,
	var_function_list character varying)
RETURNS TABLE(type character varying, element text) 
    LANGUAGE 'sql'
    COST 100
    VOLATILE 
    ROWS 1000
AS $BODY$
SELECT 'JUNCTIONS',row_to_json(tmp_junctions)::text
FROM (
	select id,round(AVG(elevation)) as elevation,round(AVG(demand)) as demand,'' as pattern,st_astext(geometry) as geometry
	FROM (
	select 'junction_'||pr.fk_node_a as id, COALESCE(n.altitude,0) as elevation, round(((to_number(COALESCE(pp._material_diameter,'0'),'9999')/2)^2)*3.14159*1/100) as demand, n.geometry
	FROM qwat_od.vw_pipe_reference as pr
		join qwat_od.vw_qwat_node as n on n.id=pr.fk_node_a 
		join qwat_od.vw_pipe as pp on pr.fk_pipe=pp.id
	where st_intersects(pp.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	and CASE WHEN var_function_list='' THEN true ELSE pp.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END
	and n.geometry NOT IN (SELECT geometry FROM qwat_od.vw_element_installation WHERE installation_type = 'tank')
	union
	select 'junction_'||pr.fk_node_b as id, COALESCE(n.altitude,0) as elevation, round(((to_number(COALESCE(pp._material_diameter,'0'),'9999')/2)^2)*3.14159*1/100) as demand, n.geometry
	FROM qwat_od.vw_pipe_reference as pr
		join qwat_od.vw_qwat_node as n on n.id=pr.fk_node_b
		join qwat_od.vw_pipe as pp on pr.fk_pipe=pp.id
	where st_intersects(pp.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	and CASE WHEN var_function_list='' THEN true ELSE pp.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END
	and n.geometry NOT IN (SELECT geometry FROM qwat_od.vw_element_installation WHERE installation_type = 'tank')
	) tmp1
	GROUP BY id,geometry
) tmp_junctions
UNION
	SELECT 'RESERVOIRS',row_to_json(tmp_reservoirs)::text
	FROM ( SELECT 'reservoir_'||id, height_max as head, '' as head_pattern, st_astext(geometry) as geometry
			FROM qwat_od.vw_qwat_network_element as n
		  WHERE element_type::text = 'reservoirs' 
		  and st_intersects(n.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
		  ) tmp_reservoirs
UNION
	SELECT 'TANKS',row_to_json(tmp_tanks)::text
	FROM ( SELECT 'tank_'||id as id, COALESCE(altitude_apron,0) as elevation, 0 as initlevel, 0 as minlevel, COALESCE(altitude_overflow,0) - COALESCE(altitude_apron,0) as maxlevel, (COALESCE(cistern1_dimension_1,0) + COALESCE(cistern1_dimension_2,0))/2 as diameter, 0 as minvol, COALESCE(storage_total,0) as volcurve, st_astext(geometry) as geometry
			FROM qwat_od.vw_element_installation as i
		  WHERE installation_type = 'tank'
		and st_intersects(i.geometry_polygon,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
		 ) tmp_tanks
UNION
	SELECT 'SOURCES',row_to_json(tmp_sources)::text
	FROM ( SELECT 'source_'||i.id as id, replace(source_type.value_ro,' ','_') as type, replace(source_quality.value_ro,' ','_') as quality, st_astext(geometry) as geometry
			FROM qwat_od.vw_element_installation as i 
					join qwat_vl.source_type ON i.fk_source_type=source_type.id
					join qwat_vl.source_quality ON i.fk_source_quality=source_quality.id
		  WHERE installation_type = 'source'
		and st_intersects(i.geometry_polygon,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
		 ) tmp_sources
UNION
	SELECT 'VALVES',row_to_json(tmp_valves)::text
	FROM (
		select 'valve_'||v.id as id, 'junction_'||pr.fk_node_a as node1, 'junction_'||pr.fk_node_b as node2, v.diameter_nominal as diameter, 
		replace(valve_type.value_ro,' ','_') as type, 
		v.closed as setting, 
		0 as minorloss,
		st_astext(v.geometry) as geometry
		from qwat_od.vw_element_valve as v	
			join qwat_vl.valve_type on v.fk_valve_type=valve_type.id
			join qwat_od.vw_pipe as pp on v.fk_pipe=pp.id
			join qwat_od.vw_pipe_reference as pr on  pr.fk_pipe=pp.id and ST_DWithin(v.geometry,pr.geometry,0.1)
		where CASE WHEN var_function_list='' THEN true ELSE pp.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END and st_intersects(pp.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	) tmp_valves
UNION
	SELECT 'PUMPS',row_to_json(tmp_valves)::text
	FROM (
		select 'pump_'||p.id as id, 'junction_'||pr1.fk_node_a as node1, 'junction_'||pr2.fk_node_b as node2,  
		' HEAD '||' POWER '||' SPEED '||' PATTERN ' as parameters,
		st_astext(p.geometry) as geometry
		from qwat_od.vw_element_installation as p	
			left join qwat_od.vw_pipe as p1 on p.fk_pipe_in=p1.id
				join qwat_od.vw_pipe_reference as pr1 on  pr1.fk_pipe=p1.id and ST_DWithin(p.geometry,pr1.geometry,0.1)
			left join qwat_od.vw_pipe as p2 on p.fk_pipe_out=p2.id
				join qwat_od.vw_pipe_reference as pr2 on  pr2.fk_pipe=p2.id and ST_DWithin(p.geometry,pr2.geometry,0.1)
		where (CASE WHEN var_function_list='' THEN true ELSE p1.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END 
				or 
		   CASE WHEN var_function_list='' THEN true ELSE p2.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END) 
			and ( st_intersects(p1.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
				or
			st_intersects(p2.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						) 
				  )	
	) tmp_valves
UNION
SELECT 'PIPES',row_to_json(tmp_pipes)::text
FROM (
	select 'pipe_'||pr.id::varchar as id, 'junction_'||pr.fk_node_a as node1, 'junction_'||pr.fk_node_b as node2, ST_Length(pr.geometry) as length, coalesce(pm.diameter,'1') as diameter, 100  as roughness, 0 as minorloss, 'Open' as status, st_astext(pr.geometry) as geometry
	from qwat_od.vw_pipe_reference as pr
		inner join qwat_od.pipe as p on pr.fk_pipe=p.id
		left join qwat_vl.pipe_material as pm on p.id = pm.id
	where st_intersects(p.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	and CASE WHEN var_function_list='' THEN true ELSE p.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END AND pr.fk_node_a IN (SELECT id FROM qwat_od.vw_qwat_node) AND pr.fk_node_b IN (SELECT id FROM qwat_od.vw_qwat_node)
	and ST_StartPoint(pr.geometry) NOT IN (SELECT geometry FROM qwat_od.vw_element_installation WHERE installation_type='tank')
	and ST_EndPoint(pr.geometry) NOT IN (SELECT geometry FROM qwat_od.vw_element_installation WHERE installation_type='tank')
	union
	select 'pipe_'||pr.id::varchar as id, 'tank_'||i.id as node1, 'junction_'||pr.fk_node_b as node2, ST_Length(pr.geometry) as length, coalesce(pm.diameter,'1') as diameter, 100  as roughness, 0 as minorloss, 'Open' as status, st_astext(pr.geometry) as geometry
	from qwat_od.vw_pipe_reference as pr
		inner join qwat_od.pipe as p on pr.fk_pipe=p.id
			left join qwat_vl.pipe_material as pm on p.id = pm.id
		inner join qwat_od.vw_element_installation as i on ST_DWithin(ST_StartPoint(pr.geometry), i.geometry, 0.01)
	where st_intersects(p.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	and CASE WHEN var_function_list='' THEN true ELSE p.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END 
	and pr.fk_node_a IN (SELECT id FROM qwat_od.vw_qwat_node) and pr.fk_node_b IN (SELECT id FROM qwat_od.vw_qwat_node)
	and i.installation_type = 'tank'
	union
	select 'pipe_'||pr.id::varchar as id, 'junction_'||pr.id as node1, 'tank_'||i.id as node2, ST_Length(pr.geometry) as length, coalesce(pm.diameter,'1') as diameter, 100  as roughness, 0 as minorloss, 'Open' as status, st_astext(pr.geometry) as geometry
	from qwat_od.vw_pipe_reference as pr
		inner join qwat_od.pipe as p on pr.fk_pipe=p.id
			left join qwat_vl.pipe_material as pm on p.id = pm.id
		inner join qwat_od.vw_element_installation as i on ST_DWithin(ST_EndPoint(pr.geometry),i.geometry,0.01)
	where st_intersects(p.geometry,(select ST_SetSRID(ST_MakeEnvelope(e[1],e[2],e[3],e[4]), var_srid)
									from (
									select array_agg(el) e
									from (
									select to_number(unnest(string_to_array(var_bbox,',')),'9999999999999.99999999') el
										) t1
									) t2)
						)
	and CASE WHEN var_function_list='' THEN true ELSE p.fk_function IN (SELECT to_number(unnest(string_to_array(var_function_list,',')),'99999')) END 
	and pr.fk_node_a IN (SELECT id FROM qwat_od.vw_qwat_node) and pr.fk_node_b IN (SELECT id FROM qwat_od.vw_qwat_node)
	and i.installation_type = 'tank'
	) tmp_pipes
	

$BODY$;

												    
