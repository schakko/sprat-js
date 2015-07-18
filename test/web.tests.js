QUnit.test("Named parameter is replaced", function(assert) {
	var result = sprat.web.uri.parse('https://localhost/rest/users/{id}', {id: 666});

	equal(result, "https://localhost/rest/users/666", "Named parameter is replaced");
});

QUnit.test("{?projection} is removed from result set if not passed", function(assert) {
	var result = sprat.web.uri.parse('https://localhost/rest/users/666{?projection}');

	equal(result, "https://localhost/rest/users/666", "{?projection} is removed");
});

QUnit.test("'?name={name:mbi}' falls back to default value if not passed", function(assert) {
	var result = sprat.web.uri.parse('https://localhost/rest/users/666?name={name:mbi}');

	equal(result, "https://localhost/rest/users/666?name=mbi", "default value is set");
});

QUnit.test("{?projection} is replaced if passed as argument", function(assert) {
	var result = sprat.web.uri.parse('https://localhost/rest/users/666{?projection}', ["projection"]);

	equal(result, "https://localhost/rest/users/666?projection", "Optional data is ignored");
});


QUnit.test("_links.self.href can be resolved", function(assert) {
	var result = sprat.web.json.hal.resolveRelation("self", {
		_links : {
			self : {
				href : 'https://localhost/rest/users/666'
			}
		}
	});

	equal(result, "https://localhost/rest/users/666", "Object data structure is parsed");
});

QUnit.test("_links[rel=self] can be resolved", function(assert) {
	var result = sprat.web.json.hal.resolveRelation("self", {
		_links : [{
			rel: "self",
			href : 'https://localhost/rest/users/666'
		}]
	});

	equal(result, "https://localhost/rest/users/666", "Array data structure is parsed");
});

QUnit.test("Unknown relation returns unefined", function(assert) {
	var result = sprat.web.json.hal.resolveRelation("unknown", {
		_links : [{
			rel: "self",
			href : 'https://localhost/rest/users/666'
		}]
	});

	equal(result, undefined, "Undefined result");
});