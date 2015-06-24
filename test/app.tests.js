QUnit.module( "sprat.app", {
	beforeEach: function( assert ) {
		sprat.$spratAppInstance = null;
	},
});
 
QUnit.test("Missing app configuration parameter throws exception", function(assert) {
	try {
		var sut = new sprat.app();
	}
	catch (ex) {
		equal(ex, "You must provide a configuration object for your Sprat application", "missing configuration exception is thrown");
		equal(sprat.$spratAppInstance, null, "app instance is null");
	}
});

QUnit.test("Invalid flavor results in an exception", function(assert) {
	try {
		var sut = new sprat.app({
			flavor: "unknown"
		});
	}
	catch (ex) {
		equal(ex, "Only 'spring' or 'laravel' allowed as flavor", "invalid flavor exception is thrown");
		equal(sprat.$spratAppInstance, null, "app instance is null");
	}
});

QUnit.test("sprat.$spratAppInstance can be initialized", function(assert) {
	var sut = new sprat.app({
		flavor: "spring"
	});
	
	ok(sprat.$spratAppInstance !== null,  "app instance is not null");
	equal(sprat.$spratAppInstance.flavor(), "spring", "spring flavor is active");
});

QUnit.test("initialize() triggers configuration method", function(assert) {
	var triggered = false;
	
	var sut = new sprat.app({
		flavor: "spring",
		configure: function() {
			triggered = true;
		}
	});
	
	sut.initialize();
	
	ok(triggered,  "Configuration method has been triggered");
});
