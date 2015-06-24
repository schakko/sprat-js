QUnit.test("sprat.wrestle.updatePipes uses default config if no success callbacks are provided", function(assert) {
	var r = sprat.wrestle.updatePipes(undefined, undefined, {});
	equal(sprat.wrestle.configuration.defaults.success().length, r.pipes.success.length);
	equal(sprat.wrestle.configuration.defaults.fail().length, r.pipes.fail.length);
});

QUnit.test("sprat.wrestle.updatePipes uses success callbacks", function(assert) {
	var r = sprat.wrestle.updatePipes([ function() {
		return "test";
	} ], undefined, {});
	
	equal(1, r.pipes.success.length);
	equal(sprat.wrestle.configuration.defaults.fail().length, r.pipes.fail.length);
	equal("test", r.pipes.success[0]());
});

QUnit.test("sprat.wrestle.updatePipes uses error callbacks", function(assert) {
	var r = sprat.wrestle.updatePipes([ function() {
		return "test";
	} ], function() {
		return "error";
	}, {});
	
	equal(r.pipes.fail.length, 1);
	equal("error", r.pipes.fail[0]());
});

QUnit.test("$.restGet maps to sprat.wrestle._delegateSimpleRequest", function(assert) {
	var mock = this.mock(sprat.wrestle);
	mock.expects("_delegateSimpleRequest").once();
	
	$.restGet('any', {});
	
	mock.verify();
});

QUnit.test("_delegateSimpleRequest(url) is valid", function(assert) {
	var mock = sinon.mock(sprat.wrestle);
	
	mock.expects("call").once().withArgs('https://my_url', null, 'GET');
	
	sprat.wrestle._delegateSimpleRequest([ 'https://my_url' ], "GET");
	mock.verify();
});

QUnit.test("$.get(_url, data: {}) is valid", function(assert) {
	var mock = sinon.mock(sprat.wrestle);
	mock.expects("call").once().withArgs('any', { key : 'value'}, 'GET');

	$.restGet('any', {
		key : 'value'
	});

	mock.verify();
});

QUnit.test("$.get(_url, data: {}, function success() {}) is valid", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");

	$.restGet('any', {
		key : 'value'
	}, function() {
		return "EXPECTED";
	});

	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[0], 'any');
	equal(sprat.wrestle.call.getCall(0).args[1].key, 'value');
	equal(sprat.wrestle.call.getCall(0).args[2], 'GET');
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success.length, 1);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success[0](), "EXPECTED");
});

QUnit.test("$.get(_url, data: {}, [function success() {}, function success2(){}]) is valid", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	$.restGet('any', {
			key : 'value'
		}, [ function() {
			return "EXPECTED";
		}, function() {
			return "EXPECTED2";
		} ]
	);

	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[0], 'any');
	equal(sprat.wrestle.call.getCall(0).args[1].key, 'value');
	equal(sprat.wrestle.call.getCall(0).args[2], 'GET');
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success.length, 2);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success[0](), "EXPECTED");
});

QUnit.test("$.get(_url, data: {}, [function success() {}, function success2(){}], function error() {}) is valid", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	$.restGet('any', {
			key : 'value'
		}, [ function() {
			return "EXPECTED";
		}, function() {
			return "EXPECTED2";
		} ], function() {
			return "EXPECTED_ERROR";
		}
	);

	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[0], 'any');
	equal(sprat.wrestle.call.getCall(0).args[1].key, 'value');
	equal(sprat.wrestle.call.getCall(0).args[2], 'GET');
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.fail.length, 1);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.fail[0](), "EXPECTED_ERROR");

});

QUnit.test("$.get(_url, [ function success() {}]) is valid", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	$.restGet('any', function() {
		return "EXPECTED";
	});
	
	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[0], 'any');
	equal(sprat.wrestle.call.getCall(0).args[1], null);
	equal(sprat.wrestle.call.getCall(0).args[2], 'GET');
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success.length, 1);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success[0](), "EXPECTED");

});

QUnit.test("$.get(_url, data: {}, [function success() {}, function success2(){}], [function error() {}, function error2() {}) is valid",
	function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	$.restGet('any', {
			key : 'value'
		}, [ function() {
			return "EXPECTED";
		}, function() {
			return "EXPECTED2";
		} ], [ function() {
			return "EXPECTED_ERROR";
		}, function() {
			return "EXPECTED_ERROR2";
		} 
	]);

	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[0], 'any');
	equal(sprat.wrestle.call.getCall(0).args[1].key, 'value');
	equal(sprat.wrestle.call.getCall(0).args[2], 'GET');
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.fail.length, 2);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.fail[1](), "EXPECTED_ERROR2");
});

QUnit.test("$.get(_url, data: {}, context: {}) is valid for overwriting $.ajax options", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	$.restGet('any', {
		key : 'value'
	}, {
		ajax : {
			datatype : "text test"
		}
	});

	ok(sprat.wrestle.call.calledOnce);
	equal(sprat.wrestle.call.getCall(0).args[3].ajax.datatype, "text test");
});

QUnit.test("Profiles can be configured", function(assert) {
	var spy = this.spy(sprat.wrestle, "call");
	
	var profile = {
		fail : [ function() {
			return "EXPECTED";
		} ],
	};

	sprat.wrestle.configuration.profiles.add('my_profile', profile);

	$.restGet('any', null, {
		'profile' : 'my_profile'
	});
	
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.success.length, 0);
	equal(sprat.wrestle.call.getCall(0).args[3].pipes.fail[0](), "EXPECTED");
});

QUnit.test("GET data is not serialized but added as JSON object to $.ajax({data: ... })", function(assert) {
	var spy = this.spy(jQuery, "ajax");

	$.restGet('any', {
		key : 'value'
	});

	equal(jQuery.ajax.getCall(0).args[0].data.key, 'value');
});

QUnit.test("POST data must be serialized passed to $.ajax({data: ... })", function(assert) {
	var spy = this.spy(jQuery, "ajax");

	$.restPost('any', {
		key : 'value'
	});

	equal(typeof (jQuery.ajax.getCall(0).args[0].data), 'string');
});

QUnit.test("always.successForHttpHeaderBetween200And399 runs pipes.success if status code is 200", function(assert) {
	var isCalled = false;

	new sprat.wrestle.pipes.always.successForHttpHeaderBetween200And399()({
		status : 200,
		readyState : 200,
		responseText : "OK"
	}, null, null, {
		pipes : {
			success : [ function() {
				isCalled = true;
			} ]
		}
	});

	equal(isCalled, true);
});

QUnit.test("always.fallbackToFail is executed as firstResponseHandler and executes custom error handler", function(
		assert) {
	var isCalled = false;

	sprat.wrestle.run(sprat.wrestle.configuration.firstResponseHandlers(), {
		status : 400,
		readyState : 400,
		responseText : "FAIL"
	}, null, null, {
		pipes : {
			fail : [ function() {
				isCalled = true;
			} ]
		}
	});

	equal(isCalled, true);
});

QUnit.test("Pipes are no longer executed if pipe returns true", function(assert) {
	var firstIsCalled = false;
	var secondIsCalled = false;

	sprat.wrestle.run([ function() {
		firstIsCalled = true;
		return true;
	}, function() {
		secondIsCalled = true;
		return "LA";
	} ]);

	equal(firstIsCalled, true);
	equal(secondIsCalled, false);
});

QUnit.test("Following pipes are executed if function returns nothing", function(assert) {
	var firstIsCalled = false;
	var secondIsCalled = false;

	sprat.wrestle.run([ function() {
		firstIsCalled = true;
	}, function() {
		secondIsCalled = true;
	} ]);

	equal(firstIsCalled, true);
	equal(secondIsCalled, true);
});