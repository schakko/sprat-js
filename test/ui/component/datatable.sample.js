// Mock renderer
sprat.ui.renderer.register('my_renderer', function(data) {
	return data.type;
});

// Mock AJAX call
$.restGet = function(restEndpoint, b, callback) {
	var data = [];
	var embedded = null;
	var i = 0, m = 0;
	
	// return mock data
	if (restEndpoint == '/rest/units') {
		for (i = 0, m = 10; i < m; i++) {
			data.push({ "name": "Name " + i, "description": "Description " + i, "type": "type " + i, "count": i});
		}

		embedded = "units";
	}
	else if (restEndpoint == '/rest/types') {
		for (i = 0, m = 10; i < m; i++) {
			data.push({ "type": "Typ " + i, "count": i, value: i * 10});
		}

		embedded = "types";
	}
	else if (restEndpoint == '/rest/types?extended') {
		for (i = 0, m = 10; i < m; i++) {
			data.push({ "type": "Typ (extended) " + i, "count": i, value: i * 10});
		}

		embedded = "types";
	}
	
	var jsonResult = {
		"_embedded": {
		},
		"totalElements": data.length 
	};
	
	jsonResult._embedded[embedded] = data;
	
	callback(jsonResult);
};