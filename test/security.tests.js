var xhr, requests;

QUnit.module( "sprat.app", {
	beforeEach: function( assert ) {
		xhr = sinon.useFakeXMLHttpRequest();
		requests = [];
		xhr.onCreate = function (req) { requests.push(req); };
	},
	afterEach: function(assert) {
		// Like before we must clean up when tampering with globals.
		xhr.restore();
	}
});

/** helper method  */
function hasHeader(_header, _value) {
	for (var header in requests[0].requestHeaders) {
		var value = requests[0].requestHeaders[header];
		
		if (header == _header && value == _value) {
			return true;
		}
	}
	
	return false;
}

QUnit.test("configureSpringSecurity adds request header", function(assert) {
	sprat.security.csrf.configureSpringSecurity();
	
	jQuery.ajax({} /** empty call */);
	
	ok(hasHeader("FIXTURE-CSRF-HEADER", "FIXTURE-CSRF-VALUE"), "header for Spring Security has been set");
});

QUnit.test("configureLaravel adds request header", function(assert) {
	sprat.security.csrf.configureLaravel();

	jQuery.ajax({} /** empty call */);

	ok(hasHeader("X-CSRF-TOKEN", "FIXTURE-CSRF-VALUE"), "header for Laravel has been set");
});

QUnit.test("Sprat application with Laravel flavor choses configureLaravel", function(assert) {
	var sut = new sprat.app({ flavor: "laravel" });

	sprat.security.csrf.configure();

	jQuery.ajax({} /** empty call */);

	ok(hasHeader("X-CSRF-TOKEN", "FIXTURE-CSRF-VALUE"), "header for Laravel has been set");
});