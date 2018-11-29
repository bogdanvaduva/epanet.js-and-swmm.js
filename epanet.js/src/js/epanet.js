// Parser for EPANET INP files
d3.inp = function() {
    function inp() {
    }

    inp.parse = function(text) {
	var regex = {
	    section: /^\s*\[\s*([^\]]*)\s*\].*$/,
	    value: /\s*([^\s]+)([^;]*).*$/,
	    comment: /^\s*;.*$/
	},
	parser = {
	    COORDINATES: function(section, key, line) {
		var m = line.match(/\s*([0-9\.]+)\s+([0-9\.]+)/);
		if (m && m.length && 3 === m.length)
		    section[key] = {x: parseFloat(m[1]), y: parseFloat(m[2])};
	    },
	    LABELS: function(section, key, line) {
		var m = line.match(/\s+([[0-9\.]+)\s+"([^"]+)"/);
		if (m && m.length && 3 === m.length)
		    section[section.length] = {x: parseFloat(key), y: parseFloat(m[1]), label: m[2]};
	    },
	    PIPES: function(section, key, line) {
		var m = line.match(/\s*([^\s;]+)\s+([^\s;]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([0-9\.]+)\s+([^;]).*/);
		if (m && m.length && 8 === m.length) {
		    section[key] = {NODE1: m[1], NODE2: m[2], LENGTH: parseFloat(m[3]),
			DIAMETER: parseFloat(m[4]), ROUGHNESS: parseFloat(m[5]),
			MINORLOSS: parseFloat(m[6]), STATUS: m[7]};
		}
	    },
	    PUMPS: function(section, key, line) {
		var m = line.match(/\s*([^\s;]+)\s+([^\s;]+)\s+([^;]+).*/);
		if (m && m.length && 4 === m.length) {
		    section[key] = {NODE1: m[1], NODE2: m[2], PARAMETERS: m[3]};
		}
	    },
	    TIMES: function(section, key, line) {
		var m = line.match(/(CLOCKTIME|START|TIMESTEP)\s+([^\s].*[^\s])\s*/i);
		if (m && m.length && 3 === m.length) {
		    section[(key + ' ' + m[1]).toUpperCase()] = m[2];
		}
		else {
		    section[key.toUpperCase()] = line.replace(/^\s+/, '').replace(/\s+$/, '');
		}
	    },
	    VALVES: function(section, key, line) {
		var m = line.match(/\s*([^\s;]+)\s+([^\s;]+)\s+([0-9\.]+)\s+([^\s;]+)\s+([^\s;]+)\s+([0-9\.]+).*/);
		if (m && m.length && 7 === m.length) {
		    section[key] = {NODE1: m[1], NODE2: m[2], DIAMETER: parseFloat(m[3]),
			TYPE: m[4], SETTING: m[5],
			MINORLOSS: parseFloat(m[6])};
		}
	    },
	    VERTICES: function(section, key, line) {
		var m = line.match(/\s*([0-9\.]+)\s+([0-9\.]+)/),
		v = section[key] || [],
		c = {};
		if (m && m.length && 3 === m.length) {
		    c.x = parseFloat(m[1]);
		    c.y = parseFloat(m[2]);
		}
		v[v.length] = c;
		section[key] = v;
	    }
	},
	model = {COORDINATES: {}, LABELS: [], RESERVOIRS: {}, TANKS: {}},
	lines = text.split(/\r\n|\r|\n/),
		section = null;
	lines.forEach(function(line) {
	    if (regex.comment.test(line)) {
		return;
	    } else if (regex.section.test(line)) {
		var s = line.match(regex.section);
		if ('undefined' === typeof model[s[1]])
		    model[s[1]] = {};
		section = s[1];
	    } else if (regex.value.test(line)) {
		var v = line.match(regex.value);
		if (parser[section])
		    parser[section](model[section], v[1], v[2]);
		else
		    model[section][v[1]] = v[2];
	    }
	    ;
	});
	return model;
    };

    return inp;
};

// Read EPANET binary result files
d3.epanetresult = function() {
    function epanetresult() { }

    epanetresult.i4 = Module._malloc(4);
    epanetresult.string = Module._malloc(255);

    epanetresult.parse = function(filename) {
	var c = (FS.findObject(filename) ? FS.findObject(filename).contents : ''),
		r = {},
		er = epanetresult,
		count = {
	    'NODES': er.readInt(c, 8),
	    'TANKS': er.readInt(c, 12),
	    'LINKS': er.readInt(c, 16),
	    'PUMPS': er.readInt(c, 20)
	},
	numReportStart = er.readInt(c, 48),
        numTimeStep = er.readInt(c, 52),
        numDuration = er.readInt(c, 56),
        numPeriods = (numDuration / numTimeStep) + 1,
        offsetNodeIDs = 884,
        offsetLinkIDs = offsetNodeIDs + (32 * count['NODES']),
        offsetNodeResults = offsetNodeIDs + (36 * count['NODES']) + (52 * count['LINKS']) +
        (8 * count['TANKS']) + (28 * count['PUMPS']) + 4,
        offsetLinkResults = 16 * count['NODES'] + offsetNodeResults,
        i,
        j;	
	// Loop over periods
	for (i = 0; i < numPeriods; i++) {
	    r[i + 1] = {'NODES': {}, 'LINKS': {}};
	    
	    // Nodes
	    for (j = 0; j < count['NODES']; j++) {
		var id = Module.intArrayToString(Array.prototype.slice.call(c,
			offsetNodeIDs + (j * 32), offsetNodeIDs + 32 + (j * 32))).replace(/[^a-z0-9_\.]/gi, '');		
		r[i + 1]['NODES'][id] = {
		    'DEMAND': er.readFloat(c, offsetNodeResults + (j * 4)),
		    'HEAD': er.readFloat(c, offsetNodeResults + ((count['NODES'] + j) * 4)),
		    'PRESSURE': er.readFloat(c, offsetNodeResults + ((2 * count['NODES'] + j) * 4)),
		    'QUALITY': er.readFloat(c, offsetNodeResults + ((3 * count['NODES'] + j) * 4))
		};
	    }
	    
	    // Links
	    for( j = 0; j < count['LINKS']; j++) {
		var id = Module.intArrayToString(Array.prototype.slice.call(c,
		offsetLinkIDs + (j*32), offsetLinkIDs + 32 + (j * 32))).replace(/[^a-z0-9_\.]/gi, '');
		r[i + 1]['LINKS'][id] = {
		    'FLOW': er.readFloat(c, offsetLinkResults + (j * 4)),
		    'VELOCITY': er.readFloat(c, offsetLinkResults + ((count['LINKS'] + j) * 4)),
		    'HEADLOSS': er.readFloat(c, offsetLinkResults + ((2 * count['LINKS'] + j) * 4))
		};
	    }
	    
	    offsetNodeResults += (16 * count['NODES'] + 32 * count['LINKS']);
	    offsetLinkResults += (16 * count['NODES'] + 32 * count['LINKS']);
	}
	
	return r;
    };

    epanetresult.readInt = function(content, offset) {
	Module.HEAP8.set(new Int8Array(content.slice(offset, offset + 4)), epanetresult.i4);
	return Module.getValue(epanetresult.i4, 'i32');
    };

    epanetresult.readFloat = function(content, offset) {
	Module.HEAP8.set(new Int8Array(content.slice(offset, offset + 4)), epanetresult.i4);
	return Module.getValue(epanetresult.i4, 'float');
    };

    return epanetresult;
};

var margin = {top: 1, right: 1, bottom: 6, left: 1},
    width = 300 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var formatNumber = d3.format(",.3f"),
    format = function(d) {
        var units = epanetjs.model['OPTIONS']['Units'].replace(/\s*/g,'') || 'CMD',
                u = epanetjs.unit(units, $('#linkResult').val().toUpperCase());
        return formatNumber(d)+' '+u;
    },
    color = d3.scaleOrdinal(d3.schemeCategory20);

var epanetjs = function() {
    epanetjs = function() {
    };

    epanetjs.INPUT = 1;
    epanetjs.ANALYSIS = 2;
    epanetjs.ANALYSIS_WITH_LEGEND = 3;
    epanetjs.ANALYSIS_SANKEY = 4;
    
    epanetjs.nodesections = ['JUNCTIONS', 'RESERVOIRS', 'TANKS'];
    epanetjs.linksections = ['PIPES', 'VALVES', 'PUMPS'];

    epanetjs.mode = epanetjs.INPUT;
    epanetjs.success = false;
    epanetjs.results = false;
    epanetjs.colors = {'NODES': false, 'LINKS': false};
    epanetjs.model = false;
    epanetjs.currentScale = 1;
    epanetjs.currentPosition = [];
    epanetjs.renderLegend = false;
    epanetjs.defaultColor = '#636363';
    
    epanetjs.setMode = function(mode) {
	epanetjs.mode = mode;
	if(epanetjs.renderLegend)
	    $('#legend').show();
	else
	    $('#legend').hide();
        
	epanetjs.render();
    };

    // Render the map
    epanetjs.svg = function() {
	var svg = function() {
	};
	
	// ======================================================================================================
	// This product includes color specifications and designs 
	// developed by Cynthia Brewer (http://colorbrewer.org/).
	// See ../../COPYING for licensing details.
	// RdYlGn
	svg.colors =  {'NODES': ["#d7191c","#fdae61","#ffffbf","#a6d96a","#1a9641"],
	// RdBu
	    'LINKS': ["#ca0020","#f4a582","#f7f7f7","#92c5de","#0571b0"]};
	// ======================================================================================================

	svg.width = window.innerWidth || document.documentElement.clientWidth || d.getElementsByTagName('body')[0].clientWidth;
	svg.height = 500;
	svg.nodemap = {};
	svg.lastNodeId = 0;
	svg.links = [];
	svg.nodes = [];
	svg.nodeSize = 1;
        svg.minx = undefined;
        svg.maxx = undefined;
        svg.miny = undefined;
        svg.maxy = undefined;
        svg.top = undefined;
        svg.strokeWidth = undefined;

	svg.removeAll = function(el) {
	    el.selectAll('line').remove();
	    el.selectAll('circle').remove();
	    el.selectAll('rect').remove();
	    el.selectAll('polygon').remove();
	    el.selectAll('text').remove();
	    el.selectAll('g').remove();
	};

	svg.tooltip = function(element) {
            var a = (element ? element.attributes : this.attributes),
                text = (a ? a['title'].value : '');
        
	    if(epanetjs.INPUT !== epanetjs.mode && epanetjs.success) {
		var fmt = d3.format('0.3f'),
                    nodeResult = $('#nodeResult').val().toUpperCase(),
                    v = (epanetjs.results[$('#time').val()] ? (epanetjs.results[$('#time').val()]['NODES'][text] ? epanetjs.results[$('#time').val()]['NODES'][text][nodeResult] : '') : '');
                text = fmt(v);
	    }

            document.getElementById('tooltip').style.display = 'block';
            document.getElementById('tooltip').style.backgroundColor = 'white';
            document.getElementById('tooltip').style.position = 'absolute';
            document.getElementById('tooltip').style.left = epanetjs.currentPosition[0] + 'px';
            document.getElementById('tooltip').style.top = epanetjs.currentPosition[1] + 'px';
            document.getElementById('tooltip').innerHTML = text;

	};

        svg.getTextSize = function() {
            var d3text = d3.select(this);
            var circ = d3.select(this.previousElementSibling); // in other cases could be parentElement or nextElementSibling
            var radius = Number(circ.attr("r"));
            var offset = Number(d3text.attr("dy"));
            var textWidth = this.getComputedTextLength(); // TODO: this could be bounding box instead
            var availWidth = svg.chordWidth(Math.abs(offset), radius); // TODO: could adjust based on ratio of dy to radius 
            availWidth = availWidth * 0.85; // fixed 15% 'padding' for now, could be more dynamic/precise based on above TODOs
            d3text.attr("data-scale", availWidth / textWidth); // sets the data attribute, which is read in the next step
        };
    
        svg.chordWidth = function(dFromCenter, radius) {
            if (dFromCenter > radius) return Number.NaN;
            if (dFromCenter === radius) return 0;
            if (dFromCenter === 0) return radius * 2;

            // a^2 + b^2 = c^2
            var a = dFromCenter;
            var c = radius;
            var b = Math.sqrt(Math.pow(c, 2) - Math.pow(a, 2)); // 1/2 of chord length

            return b * 2;
        };
        
	svg.clearTooltips = function(element) {
            document.getElementById('tooltip').style.display = 'none';
	};

	svg.render = function() {
	    var el = d3.select('#svgSimple').select('g'),
		    model = epanetjs.model,		
		    linksections = ['PIPES', 'VALVES', 'PUMPS'],
		    step = $('#time').val(),
		    nodeResult = $('#nodeResult').val().toUpperCase(),
		    linkResult = $('#linkResult').val().toUpperCase();
	    svg.removeAll(el);
            if (!el._groups[0][0]) { 
                // nothing found 
                d3.select('#svgSimple').append('g');
                el = d3.select('#svgSimple').select('g');
            }

	    if ('object' !== typeof model.COORDINATES)
		return;
            
            var coords = d3.values(model.COORDINATES),
		    x = function(c) {
		return c.x
	    },
		    y = function(c) {
		return c.y
	    };
            svg.minx = d3.min(coords, x);
            svg.maxx = d3.max(coords, x);
            svg.miny = d3.min(coords, y);
            svg.maxy = d3.max(coords, y);
            
            if (!svg.minx || !svg.maxx || !svg.miny || !svg.maxy)
                return;
            
            var height = (svg.maxy - svg.miny),
                width = (svg.maxx - svg.minx),
                scale = width * 0.1;
            
            svg.strokeWidth = height / 200;
            svg.top = svg.maxy + scale;

            d3.select('#svgSimple').attr('viewBox', (svg.minx - scale) + ' ' + 0 + ' ' + (width + 2 * scale) + ' ' + (height + 2 * scale));
	    el.attr('viewBox', (svg.minx - scale) + ' ' + 0 + ' ' + (width + 2 * scale) + ' ' + (height + 2 * scale));

	    svg.nodeSize = height / 75,
	    el.append('circle')
		    .attr('cx', svg.minx + width / 2)
		    .attr('cy', svg.top - height / 2)
		    .attr('r', svg.nodeSize)
		    .attr('style', 'fill: black');
	    var c = d3.select('circle');
	    if (c && c[0] && c[0][0] && c[0][0].getBoundingClientRect)
	    {
		var r = c[0][0].getBoundingClientRect();
		if (r && r.height && r.width) {
		    svg.nodeSize = svg.nodeSize / r.height * 10;
		}
	    }
	    svg.removeAll(el);

	    // Render links
	    for (var section in linksections) {
		var s = linksections[section];
		if (model[s]) {
		    for (var link in model[s]) {
			var l = model[s][link],
				node1 = l.NODE1 || false,
				node2 = l.NODE2 || false,
				c1 = model.COORDINATES[node1] || false,
				c2 = model.COORDINATES[node2] || false,
				v = (epanetjs.results[step] ? (epanetjs.results[step]['LINKS'][link] ? epanetjs.results[step]['LINKS'][link][linkResult] : 0): 0),
				r = epanetjs.colors['LINKS'],
				linkColors = epanetjs.svg.colors['LINKS'],
				color = (epanetjs.INPUT === epanetjs.mode ? epanetjs.defaultColor: linkColors[r(v)]);
			
			if (c1 && c2) {
			    var centerx = (c1.x + c2.x) / 2,
				    centery = (c1.y + c2.y) / 2,
				    angle = 180 / Math.PI * Math.atan2(c1.y - c2.y, c2.x - c1.x),
				    transform = 'rotate(' + angle + ' ' + centerx + ' ' + (svg.top - centery) + ')';
			    if (model['VERTICES'][link]) {
				// Render polylines                        
				var v = model['VERTICES'][link],
					d = 'M ' + c1.x + ' ' + (svg.top - c1.y);
				for (var point in v) {
				    var p = v[point];
				    d = d + ' L ' + p.x + ' ' + (svg.top - p.y);
				}
				d = d + ' L ' + c2.x + ' ' + (svg.top - c2.y);
				el.append('g').attr('id',link).append('path')
					.attr('stroke', color)
					.attr('fill', 'none')
					.attr('d', d)
                                        .attr('class', 'vertice')
					.attr('stroke-width', svg.strokeWidth);

			    } 
                            if ('PIPES' === s) {
				el.append('g').attr('id',link).append('line')
					.attr('x1', c1.x)
					.attr('y1', svg.top - c1.y)
					.attr('x2', c2.x)
					.attr('y2', svg.top - c2.y)
                                        .attr('title', link)
                                        .on('mouseover', epanetjs.svg.tooltip)
                                        .on('mouseout', epanetjs.svg.clearTooltips)
					.attr('stroke', color)
                                        .attr('class', 'pipe')
					.attr('stroke-width', svg.strokeWidth);
			    } else if ('PUMPS' === s) {
				el.append('g').attr('id',link).append('circle')
					.attr('cx', centerx)
					.attr('cy', svg.top - centery)
					.attr('r', svg.nodeSize)
                                        .attr('class', 'pump1')
					.attr('style', 'fill:'+color+';');
				el.append('g').attr('id',link).append('rect')
					.attr('width', svg.nodeSize * 1.5)
					.attr('height', svg.nodeSize)
					.attr('x', centerx)
					.attr('y', svg.top - centery - svg.nodeSize)
					.attr('transform', transform)
                                        .attr('class', 'pump2')
					.attr('style', 'fill:'+color+';');
			    } else if ('VALVES' === s) {
				el.append('g').attr('id',link).append('polygon')
					.attr('points', (centerx + svg.nodeSize) + ' ' + (svg.top - centery - svg.nodeSize) + ' ' +
					centerx + ' ' + (svg.top - centery) + ' ' +
					(centerx + svg.nodeSize) + ' ' + (svg.top - centery + svg.nodeSize))
                                        .attr('data-x', centerx)
                                        .attr('data-y', centery)
					.attr('transform', transform)
                                        .attr('class', 'valve1')
					.attr('style', 'fill:'+color+'; border: 1px blue solid;');
				el.append('g').attr('id',link).append('polygon')
					.attr('points', (centerx - svg.nodeSize) + ' ' + (svg.top - centery - svg.nodeSize) + ' ' +
					centerx + ' ' + (svg.top - centery) + ' ' +
					(centerx - svg.nodeSize) + ' ' + (svg.top - centery + svg.nodeSize))
                                        .attr('data-x', centerx)
                                        .attr('data-y', centery)
					.attr('transform', transform)
                                        .attr('class', 'valve2')
					.attr('style', 'fill:'+color+'; border: 1px blue solid;');
			    }
			}
		    }
		}
	    }
	    // Render nodes
	    for (var coordinate in model.COORDINATES)
	    {
		var c = model.COORDINATES[coordinate],			
			v = (epanetjs.results[step] ? (epanetjs.results[step]['NODES'][coordinate] ? epanetjs.results[step]['NODES'][coordinate][nodeResult] : 0) : 0),
			r = epanetjs.colors['NODES'],
			nodeColors = epanetjs.svg.colors['NODES'],
			color = (epanetjs.INPUT === epanetjs.mode ? epanetjs.defaultColor: nodeColors[r(v)]);
		if (model.RESERVOIRS[coordinate]) {
		    el.append('g').attr('id',coordinate).append('rect')
			    .attr('width', svg.nodeSize * 2)
			    .attr('height', svg.nodeSize * 2)
			    .attr('x', c.x - svg.nodeSize)
			    .attr('y', svg.top - c.y - svg.nodeSize)
			    .attr('data-x', c.x)
			    .attr('data-y', svg.top - c.y)
			    .attr('title', coordinate)
			    .attr('onmouseover', 'epanetjs.svg.tooltip(evt.target)')
			    .attr('onmouseout', 'epanetjs.svg.clearTooltips(evt.target)')
                            .attr('class', 'reservoir')
			    .attr('fill', color);
		} else if (model.TANKS[coordinate]) {
		    el.append('g').attr('id',coordinate).append('polygon')
			    .attr('points', (c.x - svg.nodeSize) + ' ' + (svg.top - c.y - svg.nodeSize) + ' ' +
			    (c.x + svg.nodeSize) + ' ' + (svg.top - c.y - svg.nodeSize) + ' ' +
			    c.x + ' ' + (svg.top - c.y + svg.nodeSize))
			    .attr('title', coordinate)
			    .attr('data-x', c.x)
			    .attr('data-y', svg.top - c.y)
                            .attr('data-y0', c.y)
			    .attr('onmouseover', 'epanetjs.svg.tooltip(evt.target)')
			    .attr('onmouseout', 'epanetjs.svg.clearTooltips(evt.target)')
                            .attr('class', 'tank')
			    .attr('fill', color);
		} else if (model.JUNCTIONS[coordinate])  {
		    el.append('g').attr('id',coordinate).append('circle')
			    .attr('cx', c.x)
			    .attr('cy', svg.top - c.y)
			    .attr('r', svg.nodeSize)
			    .attr('data-x', c.x)
			    .attr('data-y', svg.top - c.y)
			    .attr('title', coordinate)
			    .attr('onmouseover', 'epanetjs.svg.tooltip(evt.target)')
			    .attr('onmouseout', 'epanetjs.svg.clearTooltips(evt.target)')
                            .attr('class', 'junction')
			    .attr('fill', color);
		}
	    }

	    // Render labels
	    for (var label in model['LABELS']) {
		var l = model['LABELS'][label],
			t = (l['label'] ? l['label'] : '');
                if (t !== '') {
                    el.append('g').append('text')
                            .attr('x', (l['x']?l['x']:0) - svg.nodeSize * t.length / 3)
                            .attr('y', svg.top - (l['y']?l['y']:0) + svg.nodeSize * 2)
                            .text(t)
                            .attr('style', 'font-family: Verdana, Arial, sans; font-size:' + (svg.nodeSize * 2) + 'px;')
                            .attr('fill', epanetjs.defaultColor);
                }
	    }
            
            var vis = d3.select('#svgSimple');

            // zoom behaviour
            var zoom = d3.zoom().scaleExtent([0.1, 50]);
            zoom.on('zoom', function() { epanetjs.currentScale = d3.event.transform.k; epanetjs.applyScale(svg); });
            vis.call(zoom);

            epanetjs.applyScale(svg);
            
            vis.on('mousemove', function() {
                epanetjs.currentPosition = [d3.event.pageX, d3.event.pageY]; // log the mouse x,y position
                var svgEl = document.getElementById('svgSimple');
                var pt = svgEl.createSVGPoint();
                pt.x = d3.event.pageX;
                pt.y = d3.event.pageY;
                var globalPoint = pt.matrixTransform(svgEl.getScreenCTM().inverse());
                document.getElementById('xy').innerHTML = 'X: ' + (pt.x) + ', Y: ' + (pt.y);
            });
	};
        
        return svg;
    };
    
    epanetjs.applyScale = function(svg) {
        var scaleFactor = 1;
        
        d3.select('#svgSimple > g').selectAll('.vertice').each(function() { 
            this.setAttribute('stroke-width', scaleFactor * svg.strokeWidth / epanetjs.currentScale );
        });
        d3.select('#svgSimple > g').selectAll('.pipe').each(function() { 
            this.setAttribute('stroke-width', scaleFactor * svg.strokeWidth / epanetjs.currentScale );
        });
        d3.select('#svgSimple > g').selectAll('.junction').each(function() { 
            this.setAttribute('r', svg.nodeSize / epanetjs.currentScale );
        });
        d3.select('#svgSimple > g').selectAll('.tank').each(function() { 
            this.setAttribute('points', (parseFloat(this.dataset.x) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y0) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' +
                                (parseFloat(this.dataset.x) + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y0) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' +
                                parseFloat(this.dataset.x) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y0) + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale));
        });
        d3.select('#svgSimple > g').selectAll('.valve1').each(function() { 
            this.setAttribute('points', (parseFloat(this.dataset.x) + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' +
                                parseFloat(this.dataset.x) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y)) + ' ' +
                                (parseFloat(this.dataset.x)  + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale)+ ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y) + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale));
        });
        d3.select('#svgSimple > g').selectAll('.valve2').each(function() { 
            this.setAttribute('points', (parseFloat(this.dataset.x) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y) - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale) + ' ' +
                                parseFloat(this.dataset.x) + ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y)) + ' ' +
                                (parseFloat(this.dataset.x)  - 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale)+ ' ' + 
                                (parseFloat(svg.top) - parseFloat(this.dataset.y) + 1.5 * scaleFactor * svg.nodeSize / epanetjs.currentScale));
        });
        if (d3.event) {
            d3.select('#svgSimple > g')
              .attr('transform', d3.event.transform);
        }
    };
    
    epanetjs.svg = epanetjs.svg();

    // Make toolkit functions accessible in JavaScript
    epanetjs.toolkit = function() {
	var toolkit = function() {
	};

	toolkit.hour = function(time, units) {
	    // Function has to be exported by emcc
	    var hour = Module.cwrap('hour', 'double', ['string', 'string']);
	    return hour(time, units);
	};
	return toolkit;
    };
    epanetjs.toolkit = epanetjs.toolkit();
    
    epanetjs.renderAnalysis = function(renderLegendInput) {	
	var renderLegend = renderLegendInput || epanetjs.renderLegend;
	
	if (!epanetjs.success)
	    epanetjs.renderInput();
	else {
	    if(epanetjs.ANALYSIS_SANKEY === epanetjs.mode)
		return epanetjs.renderSankey();
            
	    var time = $('#time').val(),
		nodes = (epanetjs.results[time] ? epanetjs.results[time]['NODES'] : null),
		links = (epanetjs.results[time] ? epanetjs.results[time]['LINKS'] : null),		
		nodeResult = $('#nodeResult').val().toUpperCase(),
		linkResult = $('#linkResult').val().toUpperCase();
        
	    if (epanetjs.INPUT === epanetjs.mode)
		epanetjs.mode = epanetjs.ANALYSIS;
            
	    epanetjs.colors['NODES'] = d3.scaleQuantile().range(d3.range(5));
	    epanetjs.colors['NODES'].domain(d3.values(nodes).map(function(n) {
		return n[nodeResult];
	    }));
	    epanetjs.colors['LINKS'] = d3.scaleQuantile().range(d3.range(5));
	    epanetjs.colors['LINKS'].domain(d3.values(links).map(function(n) {
		return n[linkResult];
	    }));
	    svg = epanetjs.svg;
            
            if (nodeResult === '') {
                epanetjs.mode = epanetjs.INPUT;
            }
            
	    svg.render();
	    d3.select('#legend ul').remove();
	    if(renderLegend) {
		var legend = d3.select('#legend'),
			ul = legend.append('ul').attr('class', 'list-group'),
			fmt = d3.format('0.3f'),
			elements = ['Nodes', 'Links'];
		for(var el in elements) {
                    try {
                        var	el = elements[el],
                                singular = el.substr(0, el.length - 1)
                                range = epanetjs.colors[el.toUpperCase()],			    
                                quantiles = range.quantiles(),
                                v = [fmt(d3.min(range.domain()))];
                        ul.append('li').text(singular+' '+$('#'+singular.toLowerCase()+'Result').val()).attr('class', 'list-group-item active');
                        for(var q in quantiles)
                        {
                           v[v.length] = fmt(quantiles[q]);
                        }
                        v[v.length] = fmt(d3.max(range.domain()));
                        for(var i = 1; i < v.length; i++)
                        {
                            var li = ul.append('li')			    
                                    .attr('class', 'list-group-item'),
                                value = (parseFloat(v[i-1]) + parseFloat(v[i]))/2;
                            li.append('span')
                                    .attr('style', 'background:'+epanetjs.svg.colors[el.toUpperCase()][range(value)])
                                    .attr('class', 'legendcolor')
                                    .text(' ');
                            li.append('span')
                                .text(' '+v[i-1]+' to '+v[i]);
                        }
                    } catch (e) {
                        console.log(e);
                    }
                }
	    }		
	}
    };

    epanetjs.renderInput = function() {
	epanetjs.svg.render();
    };

    epanetjs.readBin = function(success) {
	epanetjs.results = (success ? d3.epanetresult().parse('/report.bin') : false);
    };

    epanetjs.render = function() {
	if (epanetjs.INPUT === epanetjs.mode)
	    epanetjs.renderInput();
	else
	    epanetjs.renderAnalysis(epanetjs.ANALYSIS_WITH_LEGEND === epanetjs.mode);
    };
    
    epanetjs.renderSankey = function () {
	var svg = d3.select('#svgSimple').select('g');
	width = $(document).width() - margin.left - margin.right;
	svg.attr('viewBox', null);
	epanetjs.svg.removeAll(svg);

	var sankey = d3.sankey()
		.nodeWidth(15)
		.nodePadding(10)
		.size([width, height]);

	var path = sankey.link();

	var model = epanetjs.model,
	    nodes = [],
	    nodemap = {},
	    links = [],
	    time = $('#time').val(),
	    results = epanetjs.results[time]['LINKS'],				
	    linkResult = $('#linkResult').val().toUpperCase();
	
	for (var section in epanetjs.nodesections) {
		var s = epanetjs.nodesections[section];
		if (model[s]) {
		    for (var node in model[s]) {
			var i = nodes.length;
			nodes[i] = {'name':node};
			nodemap[node] = i;
		    }
		}
	}
	for (var section in epanetjs.linksections) {
	    var s = epanetjs.linksections[section];
	    if(model[s]) {
		for(var id in model[s]) {
		    var link = model[s][id],
			    l = {};
		    l.source = nodemap[link.NODE1];
		    l.target = nodemap[link.NODE2];
		    l.svalue = results[id][linkResult];
		    l.value = Math.max(Math.abs(l.svalue), 0.000000000000000001);		    
		    if(0 > results[id]['FLOW']) {			
			l.source = nodemap[link.NODE2];
			l.target = nodemap[link.NODE1];
		    }
		    if(('undefined' !== typeof l.source) && ('undefined' !== typeof l.target )&& ('undefined' !== typeof l.value))
			links[links.length] = l;
		}
	    }
	}
	    sankey
		    .nodes(nodes)
		    .links(links)
		    .layout(32);

	    var link = svg.append("g").selectAll(".link")
		    .data(links)
		    .enter().append("path")
		    .attr("class", "sankeylink")
		    .attr("d", path)
		    .style("stroke-width", function(d) {
		return Math.max(1, d.dy);
	    })
		    .sort(function(a, b) {
		return b.dy - a.dy;
	    });

	    link.append("title")
		    .text(function(d) {
		return d.source.name + " → " + d.target.name + "\n" + format(d.svalue);
	    });

	    var node = svg.append("g").selectAll(".node")
		    .data(nodes)
		    .enter().append("g")
		    .attr("class", "sankeynode")
		    .attr("transform", function(d) {
		return "translate(" + d.x + "," + d.y+ ")";
	    })
		    .call(d3.behavior.drag()
		    .origin(function(d) {
		return d;
	    })
		    .on("dragstart", function() {
		this.parentNode.appendChild(this);
	    })
		    .on("drag", dragmove));

	    node.append("rect")
		    .attr("height", function(d) {
		return d.dy;
	    })
		    .attr("width", sankey.nodeWidth())
		    .style("fill", function(d) {
		return d.color = color(d.name.replace(/ .*/, ""));
	    })
		    .style("stroke", function(d) {
		return d3.rgb(d.color).darker(2);
	    })
		    .append("title")
		    .text(function(d) {
		return d.name + "\n" + format(d.value);
	    });

	    node.append("text")
		    .attr("x", -6)
		    .attr("y", function(d) {
		return d.dy / 2;
	    })
		    .attr("dy", ".35em")
		    .attr("text-anchor", "end")
		    .attr("transform", null)
		    .text(function(d) {
		return d.name;
	    })
		    .filter(function(d) {
		return d.x < width / 2;
	    })
		    .attr("x", 6 + sankey.nodeWidth())
		    .attr("text-anchor", "start");

	    function dragmove(d) {
		d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
		sankey.relayout();
		link.attr("d", path);
	    }
    };

    epanetjs.setSuccess = function(success) {
	var time = d3.select('#time');
	epanetjs.success = success;
	epanetjs.readBin(success);
	time.selectAll('option').remove();
	epanetjs.model = d3.inp().parse(document.getElementById('inpFile').value)
	if (epanetjs.results) {
	    var reportTime = (epanetjs.model['TIMES'] ? epanetjs.parseTime(epanetjs.model['TIMES']['REPORT START']) : undefined),
		    reportTimestep = (epanetjs.model['TIMES'] ? epanetjs.parseTime(epanetjs.model['TIMES']['REPORT TIMESTEP']) : undefined);
	    for (var t in epanetjs.results) {
		time.append('option')
                    .attr('value', t)
                    .text(epanetjs.clocktime(reportTime));
		reportTime += reportTimestep;
	    }
	}
	epanetjs.render();
    };

    epanetjs.parseTime = function(text) {
	var t = parseFloat(text);
	if (!text.match(/^[0-9\.]+$/))
	{
	    t = epanetjs.toolkit.hour(text, '');
	    if (t < 0.0)
	    {
		var m = line.match(/\s*([^\s]+)\s+([^\s]+)\s*/);
		if (!m || !m.length || 3 !== m.length ||
			(t = epanetjs.toolkit.hour(m[1], m[2])) < 0.0)
		    throw 'Input Error 213: illegal option value';
	    }
	}
	return 3600.0 * t;
    };

    epanetjs.clocktime = function(seconds) {
	var h = Math.floor(seconds / 3600),
		m = Math.floor((seconds % 3600) / 60),
		s = Math.floor(seconds - 3600 * h - 60 * m),
		fmt = d3.format('02d');
	return '' + h + ':' + fmt(m) + ':' + fmt(s);
    };
    
    epanetjs.unit = function(units, parameter) {
	var u = '';
	switch(parameter) {
	    case 'FLOW':
		switch(units)
		{
		    case 'LPS':
			u = 'l/s'
			break;
		    case 'MLD':
			u = 'ML/d';
			break;
		    case 'CMH':
			u = 'm³/h';
			break;
		    case 'CMD':
			u = 'm³/h';
			break;
		    case 'CFS':
			u = 'cfs';
			break;
		    case 'GPM':
			u = 'gpm';
			break;
		    case 'MGD':
		       u = 'mgd';
		       break;
		    case 'IMGD':
			u = 'Imgd';
			break;
		}
		break;
	    case 'VELOCITY':
		switch(units)
		{
		   case 'LPS':
		   case 'MLD':
		   case 'CMH':
		   case 'CMD':
		       u = 'm/s';
		       break;
		   default:
		       u = 'fps';
		       break;
		}
		break;
	   case 'HEADLOSS':
	       switch(units)
	       {
		   case 'LPS':
		   case 'MLD':
		   case 'CMH':
		   case 'CMD':
		       u = '/ 1000m';
		       break;
		   default:
		       u = '/ 1000ft';
		       break;
	       }
	       break;
	}
	return u;
    };

    epanetjs.run = function(Module) {
        FS.quit();
        Module.arguments = ['/input.inp', '/report.txt', '/report.bin'];
        Module.preRun = [function () {
                FS.createPath('/', '/', true, true);
                FS.ignorePermissions = true;
                try
                {
                    var inp = document.getElementById('inpFile').value;
                    var f = FS.findObject('input.inp');
                    if (f) {
                        FS.unlink('input.inp');
                    }
                    FS.createDataFile('/', 'input.inp', inp, true, true);
                } catch (e) {
                    console.log('/input.inp creation failed');
                }
            }];
        Module.postRun = [function () {
                epanetjs.renderAnalysis();
                var rpt = Module.intArrayToString(FS.findObject('/report.txt').contents);
                document.getElementById('rptFile').innerHTML = rpt;
                Module['calledRun'] = false;
            }];
        Module.print = (function () {
            var element = document.getElementById('output');
            if (element)
                element.value = ''; // clear browser cache
            return function (text) {
                if (arguments.length > 1)
                    text = Array.prototype.slice.call(arguments).join(' ');
                console.log(text);
                if (element) {
                    element.value += text + "\n";
                    element.scrollTop = element.scrollHeight; // focus on bottom
                }
            };
        })();
        Module.printErr = function (text) {
            if (arguments.length > 1)
                text = Array.prototype.slice.call(arguments).join(' ');
            console.error(text);
        };
        Module.canvas = (function () {
            var canvas = document.getElementById('canvas');

            // As a default initial behavior, pop up an alert when webgl context is lost. To make your
            // application robust, you may want to override this behavior before shipping!
            // See http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.15.2
            canvas.addEventListener("webglcontextlost", function (e) {
                alert('WebGL context lost. You will need to reload the page.');
                e.preventDefault();
            }, false);

            return canvas;
        })();
        Module.setStatus = function (text) {
            var statusElement = document.getElementById('status');

            var progressElement = document.getElementById('progress');
            if (!Module.setStatus.last)
                Module.setStatus.last = {time: Date.now(), text: ''};
            if (text === Module.setStatus.last.text) {
                return;
            }
            var m = text.match(/([^(]+)\((\d+(\.\d+)?)\/(\d+)\)/);
            var now = Date.now();
            if (m && now - Module.setStatus.last.time < 30)
                return; // if this is a progress update, skip it if too soon
            Module.setStatus.last.time = now;
            Module.setStatus.last.text = text;
            if (m) {
                text = m[1];
                progressElement.value = parseInt(m[2]) * 100;
                progressElement.max = parseInt(m[4]) * 100;
                progressElement.hidden = false;
            } else {
                progressElement.value = null;
                progressElement.max = null;
                progressElement.hidden = true;
            }
            statusElement.innerHTML = text;
            if (text === "") {
                epanetjs.setSuccess(true);
                exitRuntime();
                console.log(JSON.stringify(epanetjs.results));
            } 
        };
        Module.totalDependencies = 0;
        Module.monitorRunDependencies = function (left) {
            this.totalDependencies = Math.max(this.totalDependencies, left);
            Module.setStatus(left ? 'Preparing... (' + (this.totalDependencies - left) + '/' + this.totalDependencies + ')' : 'All downloads complete.');
        };

        Module.setStatus('Downloading...');
        window.onerror = function (event) {
            // TODO: do not warn on ok events like simulating an infinite loop or exitStatus
            Module.setStatus('Exception thrown, see JavaScript console');
            Module.setStatus = function (text) {
                if (text)
                    Module.printErr('[post-exception status] ' + text);
            };
        };

        Module['calledRun'] = false;
        Module['run']();
    };

    return epanetjs;
};

epanetjs = epanetjs();


