var S2 = function($, d3) {
  var S_my = {};
  
  // From colorbrewer2.org, "paired"
  S_my.colors = [
    d3.rgb(31, 120, 180), // blue
    d3.rgb(51, 190, 77), // green
    d3.rgb(183, 5, 7), // red
    d3.rgb(255, 127, 0), // orange
    d3.rgb(166, 206, 227), // lightblue
    d3.rgb(178, 223, 138), // lightgreen
    d3.rgb(251, 154, 153), // lightred
    d3.rgb(253, 191, 111) // lightorange
  ];
  
  S_my.color_scales = d3.scale.ordinal()
    .domain([0,1,2,3,4,5,6,7])
    .range(S_my.colors.map( function(c) { 
      return d3.scale.linear()
        .domain([0,1])
        .range(['lightgrey', c]);
      }));
  
  function intify(string_ar) {
    return $.map(string_ar, function(e) {
      return parseInt(e, 10);
    });
  }
  S_my.intify = intify;
  
  function short_float(val, places) {
    if (!places) { places = 4; }
    var vf = parseFloat(val),
      exponent = Math.abs(Math.log(Math.abs(val))/Math.log(10)),
      out_str = vf.toFixed(places);
    
    if (exponent >= places) { out_str = vf.toExponential(places-1); }
    
    return out_str;
  }
  
  function csv_split(str) {
    var splitted = []
    if (str && str !== "") {
     splitted = str.split(",") 
    }
    return intify(splitted);
  }
  S_my.csv_split = csv_split;
  
  var underscore_regex = new RegExp("_", "g");
  var break_regex = new RegExp("([a-z])([^a-z 0-9])", "g");
  function add_breaks(s) {
    var replaced = s.replace(underscore_regex, " ");
    return replaced.replace(break_regex, "$1&#8203;$2");
  }
  S_my.add_breaks = add_breaks;

  S_my.scatterplot = function(container, 
      data_width, 
      data_height, 
      top_outer_margin,
      right_outer_margin,
      axis_margin, 
      label_width,
      x_label_margin,
      y_label_margin,
      colormap) {
    
    var my = {},
      pub = {}, 
      svg = d3.select(container).append('svg:svg');
    
    // initialization code
    my.data_width = data_width;
    my.data_height = data_height;
    my.top_outer_margin = top_outer_margin;
    my.right_outer_margin = right_outer_margin;
    my.label_width = label_width;
    my.axis_margin = axis_margin;
    my.x_label_margin = x_label_margin;
    my.y_label_margin = y_label_margin;
    my.colormap = colormap;
    my.height = (top_outer_margin + my.data_height + 
      2*my.axis_margin + my.label_width + my.x_label_margin);
    my.width = (right_outer_margin + my.data_width + 
      2*my.axis_margin + my.label_width + my.y_label_margin);
    my.data_canvas_trans_y = my.top_outer_margin;
    my.data_canvas_trans_x = my.x_label_margin + my.label_width + 2*my.axis_margin;
    my.duration = 333;
    
    my.event = d3.dispatch("point");
    
    svg.attr('height', my.height)
      .attr('width', my.width)
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px');
    
    my.data_canvas = svg.append('svg:g')
      .attr('transform', 'translate('+my.data_canvas_trans_x+','+my.data_canvas_trans_y+')')
      .attr('id', 'data-canvas');
    
    my.click_handler = null;
    
    my.yaxis_canvas = my.data_canvas.append('svg:g')
      .attr('transform', 'translate('+ -my.axis_margin +')')
      .attr('id', 'y-axis')
      .attr('shape-rendering', 'crispEdges');
    
    my.yaxis_canvas.append('svg:line')
      .attr('id', 'y-axis-frame')
      .attr('x1', 0)
      .attr('x2', 0)
      .attr('y1', -1)
      .attr('y2', my.data_height)
      .attr('stroke', 'black')
      .attr('stroke-width', '1')
      .attr('shape-rendering', 'crispEdges');
    
    my.xaxis_canvas = my.data_canvas.append('svg:g')
      .attr('transform', 'translate(0, '+ (my.data_height+my.axis_margin)+')')
      .attr('id', 'x-axis')
      .attr('shape-rendering', 'crispEdges');
          
    my.xaxis_canvas.append('svg:line')
      .attr('id', 'x-axis-frame')
      .attr('x1', 0)
      .attr('x2', my.data_width+1)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', 'black')
      .attr('stroke-width', '1')
      .attr('shape-rendering', 'crispEdges');
      
    pub.update = function(points, regression, xlabel, ylabel) {
      // maybe the only public function?
      
      my.set_points(points);
      my.set_regression(regression);
      my.set_scales();
      my.draw_regression();
      my.draw_dots();
      my.draw_point_targets();
      my.draw_axes();
    }
    
    my.set_points = function(points) {
      my.point_data = points.map(function(p) {
        return {
          'row_id':p[0], 'x':p[1], 'y':p[2], 'weight':p[3], 'group':p[4]};});
      my.xvals = my.point_data.map(function(p) { return p.x; });
      my.yvals = my.point_data.map(function(p) { return p.y; });
    }
    
    my.set_scales = function() {
      my.x_scale = d3.scale.linear()
        .domain([d3.min(my.xvals), d3.max(my.xvals)])
        .range([0, my.data_width]);
      
      my.y_scale = d3.scale.linear()
        .domain([d3.min(my.yvals), d3.max(my.yvals)])
        .range([my.data_height, 0]);
    }
    
    my.draw_dots = function() {
      dots = my.data_canvas.selectAll('circle')
        .data(my.point_data, function(d) { return d.row_id; });
      
      dots.enter().append('svg:circle')
        .attr('cx', function(d) { return my.x_scale(d.x); })
        .attr('cy', function(d) { return my.y_scale(d.y); })
        .attr('r', 4);
      
      // Coloring should be instantaneous -- no transition here
      dots
        .attr('stroke', function(d) { return my.colormap(d.group)(d.weight); })
        .attr('fill', function(d) { return my.colormap(d.group)(d.weight); })
        .attr('fill-opacity', 0.4);
      
      
      dots.transition()
        .sort(function(d) { return d.x; })
        .duration(my.duration)
        .attr('cx', function(d) { return my.x_scale(d.x); })
        .attr('cy', function(d) { return my.y_scale(d.y); });
      
      dots.exit()
        .remove();
    } // draw_dots()
    
    my.set_regression = function(params) {
      if (params) {
        my.regression_params = [params]; // makes .data() work properly
      } else {
        my.regression_params = [];
      }
    }
    
    my.draw_regression = function() {
      var x1, x2, line;
      
      x1 = d3.min(my.xvals);
      x2 = d3.max(my.xvals);

      line = my.data_canvas.selectAll('line#regression-line')
        .data(my.regression_params);
        
      line.enter().append('svg:line')
        .attr('id', 'regression-line')
        .attr('x1', my.x_scale(x1))
        .attr('y1', function(d) { return my.y_scale(d['const'] + x1*d.slope); })
        .attr('x2', my.x_scale(x2))
        .attr('y2', function(d) { return my.y_scale(d['const'] + x2*d.slope); });

      line
        .attr('stroke', 'brown')
        .attr('stroke-width', 2)
        .attr('stroke-linecap', 'round');
      
      line.transition()
        .duration(my.duration)
        .attr('x1', my.x_scale(x1))
        .attr('y1', function(d) { return my.y_scale(d['const'] + x1*d.slope); })
        .attr('x2', my.x_scale(x2))
        .attr('y2', function(d) { return my.y_scale(d['const'] + x2*d.slope); });
        
      line.exit()
        .remove();
    }
    
    my.draw_axes = function() {
      var xticks, xticks, x_sorted, y_sorted, quantiles, xquant, yquant,
        xlabels, ylabels;
      quantiles = [0, 0.25, 0.5, 0.75, 1];
      x_sorted = my.xvals.slice().sort(d3.ascending);
      y_sorted = my.yvals.slice().sort(d3.ascending);
      xquant = quantiles.map(function(q) {return d3.quantile(x_sorted, q)});
      yquant = quantiles.map(function(q) {return d3.quantile(y_sorted, q)});
      
      xticks = my.xaxis_canvas.selectAll("line.tick")
        .data(my.point_data, function(d) { return d.row_id; });
      
      xticks.enter().append('svg:line')
        .attr('class', 'tick')
        .attr('x1', function(d) { return my.x_scale(d.x); })
        .attr('x2', function(d) { return my.x_scale(d.x); })
        .attr('y1', 0)
        .attr('y2', -7)
        .attr('stroke', 'black')
        .attr('stroke-opacity', 0.2);

      xticks.transition()
        .duration(my.duration)
        .attr('x1', function(d) { return my.x_scale(d.x); })
        .attr('x2', function(d) { return my.x_scale(d.x); });
      
      xticks.exit()
        .remove();
      
      yticks = my.yaxis_canvas.selectAll("line.tick")
        .data(my.point_data, function(d) { return d.row_id; });
      
      yticks.enter().append('svg:line')
        .attr('class', 'tick')
        .attr('y1', function(d) { return my.y_scale(d.y); })
        .attr('y2', function(d) { return my.y_scale(d.y); })
        .attr('x1', 0)
        .attr('x2', 7)
        .attr('stroke', 'black')
        .attr('stroke-opacity', 0.2);

      yticks.transition()
        .duration(my.duration)
        .attr('y1', function(d) { return my.y_scale(d.y); })
        .attr('y2', function(d) { return my.y_scale(d.y); });
      
      yticks.exit()
        .remove();
      
      // Now we add quantile labels
      xlabels = my.xaxis_canvas.selectAll("g.quantile")
        .data(xquant);

      xlabels.enter().append("svg:g")
        .attr('class', 'quantile')
        .attr('transform', function(d) {
          return 'translate('+my.x_scale(d)+', 10)';})
        .append('svg:text');
      
      xlabels.selectAll('text').text(function(d) {return d.toFixed(2); })

      xlabels.transition()
        .duration(my.duration)
        .attr('transform', function(d) {
          return 'translate('+my.x_scale(d)+', 10)';})
        .select('text').text(function(d) {return d.toFixed(2); });
      
      
      ylabels = my.yaxis_canvas.selectAll("g.quantile")
        .data(yquant);

      ylabels.enter().append("svg:g")
        .attr('class', 'quantile')
        .attr('transform', function(d) {
          return 'translate(-20, '+my.y_scale(d)+')';})
        .append('svg:text');
      
      ylabels.selectAll('text')
        .text(function(d) {return d.toFixed(2); })
        .style('dominant-baseline', 'middle');

      ylabels.transition()
        .duration(my.duration)
        .attr('transform', function(d) {
          return 'translate(-20, '+my.y_scale(d)+')';})
        .select('text').text(function(d) {return d.toFixed(2); });
      
    }
    
    my.pointed = null;
    my.pointed_data = null;
    
    my.do_point = function(p) {
      var cur_cir, tgt_cir, x_super, y_super;
      if (my.pointed) { cur_cir = my.pointed[0][0]; }
      tgt_cir = p[0][0];
      if (cur_cir === tgt_cir) { return; }

      my.pointed = p;
      p.attr('fill', 'orange').attr('stroke', 'orange')
        .each(function(d) { 
          my.pointed_data = d; });

      // And add a super xtick
      x_super = my.xaxis_canvas.selectAll('g.supertick')
        .data([my.pointed_data], function(d) {return d.row_id});
      x_super.enter().append('svg:g')
        .attr('class', 'supertick')
        .attr('transform', function(d) {
          return 'translate('+my.x_scale(d.x)+', 0)'; });

      x_super.append('svg:line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 0)
        .attr('y2', -10)
        .attr('stroke', 'black');

      x_super.append('svg:g')
        .attr('transform', 'translate(0, -14)')
        .append('svg:text');
        
      x_super.select('text').text(function(d) { return d.x.toFixed(2);});
      
      // And y.
      y_super = my.yaxis_canvas.selectAll('g.supertick')
        .data([my.pointed_data], function(d) {return d.row_id});
      
      y_super.enter().append('svg:g')
        .attr('class', 'supertick')
        .attr('transform', function(d) {
          return 'translate(0,'+my.y_scale(d.y)+')'; });
        
      y_super.append('svg:line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', 10)
        .attr('y2', 0)
        .attr('stroke', 'black');
        
      y_super.append('svg:g')
        .attr('transform', 'translate(30, 0)')
        .append('svg:text');
        
      y_super.select('text')
        .text(function(d) { return d.y.toFixed(2);})
        .style('text-anchor', 'left')
        .style('dominant-baseline', 'middle');
      
      y_super.exit()
        .remove();
    };
    
    my.do_unpoint = function(p) {
      if (!my.pointed) { return; }
      my.pointed = null;
      my.pointed_data = null;
      p
        .attr('fill', function(d) { return my.colormap(d.group)(d.weight);})
        .attr('stroke', function(d) { return my.colormap(d.group)(d.weight);});

      my.xaxis_canvas.selectAll('g.supertick').remove();
      my.yaxis_canvas.selectAll('g.supertick').remove();
    };
    
    my.distance = function(p1, p2) {
      return Math.pow(
          (
            Math.pow((p1[0]-p2[0]), 2) +
            Math.pow((p1[1]-p2[1]), 2)
          ), 
        0.5);
    }
    
    my.draw_point_targets = function() {
      var point_xy, paths, pointed, event;
      point_xy = my.point_data.map(function(p) { 
        return [my.x_scale(p.x), my.y_scale(p.y)]; 
      });
      paths = d3.geom.voronoi(point_xy);
      my.data_canvas.selectAll('path.target')
          .data(paths)
        .enter().append('svg:path')
          .attr('d', function(d) { return 'M'+d.join("L")+"Z";})
          .attr('stroke', 'transparent')
          .attr('fill', 'transparent')
          .on('mousemove', function(d, i) {
            var mouse_coords, point, point_coords, thresh=20;
            coords = d3.svg.mouse(this);
            point = d3.select(my.data_canvas.selectAll('circle')[0][i]);
            my.event.point.dispatch();
            point_coords = [
              parseFloat(point.attr('cx')), 
              parseFloat(point.attr('cy'))];
            if (my.distance(coords, point_coords) < thresh) {
              my.do_point(point);
            } else {
              my.do_unpoint(point);
            }
          })
          .on('mouseout', function(d, i) {
            point = d3.select(my.data_canvas.selectAll('circle')[0][i]);
            my.do_unpoint(point);
          })
          .on('click', function(d, i) {
            if (my.click_handler) {
              my.click_handler(my.pointed_data);
            }
          });
    }
    
    pub.set_click_handler = function(fx) {
      my.click_handler = fx;
    }
    
    console.log("hello");
    pub.my = my;
    return pub;
  }
  
  
  S_my.state_manager = function(
      regress_js_url, regress_csv_url, columns, scatterplot,
      x_control, y_control, highlight_control, nuisance_list, model_control,
      download_link, stats_container) {
    var pub = {}
    var my = {};
    
    my.base_url = regress_js_url;
    my.regress_csv_url = regress_csv_url;
    my.columns = columns;
    my.scatterplot = scatterplot;
    my.x_control = $(x_control);
    my.y_control = $(y_control);
    my.highlight_control = $(highlight_control);
    my.nuisance_list = $(nuisance_list);
    my.model_control = $(model_control);
    my.download_link = $(download_link);
    my.stats_container = $(stats_container);
    my.censored_points = [];

    my.populate_select = function(control, list, initial_index) {
      if (!initial_index) { initial_index = 0; }
      for (i = 0; i < list.length; i++) {
        control.append('<option value="'+i+'">'+list[i]+'</option>');
      }
      control.val(initial_index);
    };
    
    my.handle_scatter_click = function(data) {
      pub.toggle_point(data.row_id);
    }
    my.scatterplot.set_click_handler(my.handle_scatter_click)
    
    pub.toggle_point = function(rownum) {
      if (!isFinite(parseInt(rownum, 10))) {
        console.log("Ooh, not numeric: " + rownum);
        return; 
      }
      var cpi = my.censored_points.indexOf(rownum);
      if (cpi > -1) {
        my.censored_points.splice(cpi, 1);
      } else {
        my.censored_points.push(rownum);
      }
      my.censored_points = my.censored_points.sort();
      console.log(my.censored_points);
      pub.update_state();
    }
    
    pub.hashchange = function(evt) {
      // The main method that'll get called.
      console.log("Hashchange!");
      console.log(evt);
      pub.update_controls();
      my.download_link.attr('href', pub.csv_url());
      $.ajax({
        'url': pub.json_url(),
        'success': function(data) {
            console.log(data);
            my.scatterplot.update(
              data.points, 
              data.regression_line,
              data.x_label,
              data.y_label
              );
            update_stats(my.stats_container, data.stats_diagnostics);
          },
        'error': function() { console.log("Error?"); }
      });
    };
    
    pub.update_state = function() {
      console.log("Updating state!");
      var opts = {
        'x' : my.x_control.val(),
        'y' : my.y_control.val(),
        'm' : my.model_control.val()
      };
      var xy_ints = intify([my.x_control.val(), my.y_control.val()]);
      var nuisance_ids = $.grep(my.checked_nuisance_vals(), function(v) {
        return !(xy_ints.indexOf(v) > -1)
      });
      var highlight_idx = my.highlight_control.val();
      if (highlight_idx !== "") {
        opts.h = highlight_idx;
      }
      var nuisance_list = nuisance_ids.join(",");
      if (nuisance_list !== '') { opts.n = nuisance_list; }
      var censor_list = my.censored_points.join(",");
      if (censor_list !== '') { opts.c = censor_list; }
      console.log($.param.fragment("", opts));
      $.bbq.pushState(opts, 2);
    };
    
    pub.x_var_name = function() {
      var xidx = parseInt(my.x_control.val(), 10);
      return columns[xidx];
    }
    
    pub.y_var_name = function() {
      var yidx = parseInt(my.y_control.val(), 10);
      return columns[yidx];
    }
    
    pub.nuisance_var_names = function() {
      var names = [];
      var nuisances = my.checked_nuisance_vals();
      for (var i = 0; i < nuisances.length; i++) {
        names.push(columns[nuisances[i]]);
      }
      return names;
    }
        
    my.generate_nuisance_list = function() {
      var st = $.bbq.getState();
      var nuis_idxs = csv_split(st.n);
      var xy_idxs = intify([st.x, st.y]);
      var col_list_decorated = my.decorate_column_list_selectable(
        my.columns, xy_idxs, nuis_idxs);
      return col_list_decorated;
    };
    
    my.populate_nuisance_lists = function() {
      var list = my.generate_nuisance_list();
      my.nuisance_list.empty();
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var li = $(document.createElement("li"));
        if (!item.allowed) { li.addClass("disallowed"); }
        my.nuisance_list.append(li.append(my.make_nuisance_selector(item)));
      }
      my.nuisance_list.find("input").change(function() {
        pub.update_state();
      });
    };
    
    my.checked_nuisance_vals = function() {
      var l = [];
      var checked = my.nuisance_list.find("input:checked");
      $.each(checked, function(i, elt) { l.push(elt.value); });
      return intify(l).sort();
    };
    
    my.decorate_column_list_selectable = function(
        columns, disallowed_idxs, selected_idxs) {
      var disalloweds = intify(disallowed_idxs);
      var selecteds = intify(selected_idxs);
      
      var out = [];
      for (var i = 0; i < columns.length; i++) {
        var name = columns[i];
        var allowed = !(disalloweds.indexOf(i) > -1);
        var selected = allowed && (selecteds.indexOf(i) > -1);
        out.push({name:name, i: i, allowed: allowed, selected: selected});
      }
      return out;
    };
    
    my.make_nuisance_selector = function(n) {
      // Makes something like 
      // <input type="checkbox" id="n_X" name="n_X" value="X" />
      // <label for="n_X">Column name</label>
      var dis_str = ' disabled="disabled" ';
      if (n.allowed) { dis_str = ' '; }
      var checked_str = ' ';
      if (n.selected) { checked_str = ' checked = "checked" '; }
      var n_str = '"n_'+n.i+'"';
      out_str = '<div class="l"><input type="checkbox"'+checked_str+dis_str+'id = '+n_str+' value="'+n.i+'" /></div>';
      out_str += '<label for='+n_str+'>'+add_breaks(n.name)+'</label>';
      return out_str;
    }
    
    my.populate_select(my.x_control, my.columns, 0);
    my.populate_select(my.y_control, my.columns, 0);
    
    pub.update_controls = function() {
      // Update the controls on the page and our internal tracking of
      // censored points from the URL hash
      console.log("Update controls");
      var cur_state = $.bbq.getState();
      console.log(cur_state);
      my.x_control.val(cur_state.x);
      my.y_control.val(cur_state.y);
      my.highlight_control.val(cur_state.h || "");
      my.model_control.val(cur_state.m)
      my.populate_nuisance_lists();
      var cstr = cur_state.c || "";
      var clist = [];
      if (cstr !== "") {
        clist = intify(cstr.split(","));
      }
      my.censored_points = clist;
    };
    
    pub.json_url = function() {
      return $.param.querystring(my.base_url, $.bbq.getState(), 2);
    };
    
    pub.csv_url = function() {
      return $.param.querystring(my.regress_csv_url, $.bbq.getState(), 2);
    };
    
    my.x_control.change(function() { pub.update_state(); });
    my.y_control.change(function() { pub.update_state(); });
    my.highlight_control.change(function() { pub.update_state(); });
    my.model_control.change(function() { pub.update_state(); });
    
    pub.my = my;
    return pub;
  };
  
  function update_stats(container, stats_data) {
    var c = $(container), de, dv, opts;
    c.empty();
    for (var i=0; i < stats_data.length; i++) {
      de = stats_data[i];
      c.append("<h3>"+de.title+"</h3>");
      c.append("<table>");
      for (var j = 0; j < de.data.length; j++) {
        dv = de.data[j];
        opts = dv[2] || {};
        if (!opts.hide) {
          c.append(
            "<tr><th>"+format_stats_name(dv[0])+":</th><td>"+
            short_float(dv[1])+"</td></tr>");
        }
      }
      c.append("</table>");
    }
  };
  S_my.update_stats = update_stats;
  
  S_my.STATS_DISPLAY = {
    'Rsq': 'R&sup2;',
    'RsqAdj': 'Adj. R&sup2;',
    'b': '&beta;',
    'rho': "&rho;"
  }
  
  format_stats_name = function(key) {
    return (S_my.STATS_DISPLAY[key] || key);
  };  
  
  return S_my;
}(jQuery, d3);