if (!sprat || !sprat.ui || !sprat.ui.renderer) {
	throw "ui/renderer.js must be included first before registering custom renderers";
}

sprat.ui.renderer.register('link', function(uri, icon, text) {
	return "<a href='" + uri + "'>" + text + "</a>";
});
	
sprat.ui.renderer.register('list', function(data, type, full) {
	var names = [];

	if (jQuery.isArray(data)) {
		jQuery.each(data, function(idx, val) {
			names.push(val.name);
		});
	}

	return names.join(", ");
});

sprat.ui.renderer.register('monthAndYear', function(data, type, full) {
	return moment(data.join("."), "YYYY.MM.DD").format("MMMM YYYY");
});
			
sprat.ui.renderer.register('active', function(data, type, full) {
	var item = "minus-square", msg = "Deaktiviert";
	
	if (data == 'true' || data == '1') {
			item = "check-square";
			msg = "Aktiviert";
	}

	var r = "<i class='fa fa-" + item + "'> </i> <span>" + msg + "</span>";
	return r;
});

sprat.ui.renderer.register('stars', function(value, max) {
	max = max || 5;
	value = value || 0;
	var r = "";

	if (value > 0) {
		for (var i = 1; i <= max; i++) {
			var icon = "star-o";
			
			if (i <= value) {
				icon = "star";
			}

			r += "<i class='fa fa-" + icon + "'></i>";
		}
	}

	return r;
});

sprat.ui.renderer.register('status', function(status) {
	return "<span class='label label-warning'>" + status + "</span>";
});

sprat.ui.renderer.register('money', function(money) {
	if (parseInt(money) > 0) {
		return "€ " + money;
	}

	return "";
});

sprat.ui.renderer.register('moneyNullable', function(data, type, full) {
	if (data === null) {
		return "<em>unbekannt</em>";
	}

	return app.renderer.money(data);
});

sprat.ui.renderer.register('maps', function(data, type, full) {
	if (data === null) {
		return "<em>nicht definiert</em>";
	}

	return app.renderer.location(data);
});

sprat.ui.renderer.register('location', function(location) {
	return '<a href="https://maps.google.com/?q=' + location + '" target="__new">' + location + '</a>';
});
