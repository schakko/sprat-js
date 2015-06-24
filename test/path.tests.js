QUnit.test("Calling resource().index() function on '/users/1' returns the root action '/users/1'", function(assert) {
	var sut = new sprat.path().resourceAt('/users/1').add('index').add('bla').finish();

	equal(sut.resource().index(), "/users/1");
});

QUnit
		.test(
				"resource(666).index() will be inserted into resourceAt('/rest/users/{0}/detail') and resolves to '/rest/users/666/detail'",
				function(assert) {
					var sut = new sprat.path().resourceAt('/rest/users/{0}/detail').add('index').finish();
					equal(sut.resource(666).index(), "/rest/users/666/detail",
							"The path variable {0} is replaced by the resource() argument");
				});

QUnit
		.test(
				"Assigning the sub URI '/detail' to resourceAt('/users/1') returns the full path '/users/1/detail' when calling resource().index()",
				function(assert) {
					var sut = new sprat.path().resourceAt('/users/1').add('index', '/detail').finish();

					equal(sut.resource().index(), "/users/1/detail", '"/detail" is added to the resource root');
				});

QUnit.test("Assigning the sub URI 'detail' automagically adds the path separator '/' between resource and subURI", function(assert) {
	var sut = new sprat.path().collectionAt('/rest/users').add('index', 'create').finish();

	equal(sut.collection().index(), '/rest/users/create', 'calling index() with alias "create" on "/rest/users" resolves to "/rest/users/create" ');
});

QUnit.test("Passing a named parameter to the sub URI is resolved", function(assert) {
	var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={name}').finish();

	equal(sut.resource().byName({
		'name' : 'ckl'
	}), "/users/1?name=ckl", "Parameter 'name' is provided and resolves to 'ckl'");
});

QUnit.test("A missing template path parameter will be replaced by its default", function(assert) {
	var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={name:mbi}').finish();

	equal(sut.resource().byName({}), "/users/1?name=mbi",
			'Default parameter value "mbi" is used as parameter name is not set');
});

QUnit.test("Not passing a defined named parameter results in throwing an exception", function(assert) {
	var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={:name}');

	try {
		sut.resource().index({
			'missing_name_argument' : 'ckl'
		});

		equal(false, true, "Unexpected state!!!");
	} catch (e) {
		equal(true, true, "Exception is thrown");
	}
});

QUnit.test("Adding an already initialized collection fails", function(assert) {
	try {
		var sut = new sprat.path().collectionAt('/test');
		sut.collectionsAt('/bla');

		equal(false, true, "Unexpected state!!!");
	} catch (e) {
		equal(true, true, "Exception is thrown");
	}
});

QUnit.test("Calling a resource with too few arguments fails", function(assert) {
	try {
		var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index');
		sut.index();
		equal(false, true, "Unexpected state!!!");
	} catch (e) {
		equal(true, true, 'Exception is thrown');
	}
});

QUnit.test("Passing a function as second argument is used as a dynamic function for resolving the path", function(
		assert) {
	var sut = new sprat.path().resourceAt('/rest/users').add('index', function(state) {
		return state.root + "/EXPECTED/" + state.lastArguments[0];
	}).finish();

	equal(sut.resource().index('EXPECTED2'), '/rest/users/EXPECTED/EXPECTED2',
			'Own callback function is called to construct the returned path');

});

QUnit.test("A Spring Data or HATEOS object is resolved to its id", function(assert) {
	var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index').finish();

	equal(sut.resource({
		_links : {
			self : {
				href : 'https://localhost/rest/users/666'
			}
		}
	}).index(), '/rest/users/666', 'ID of HATEOS object is resolved');
});

QUnit.test("Assigning resource and collection mappings in one fluent call is possible", function(assert) {
	var sut = new sprat.path().resourceAt('/rest/user/{0}').add('index').finish().collectionAt(
			'/rest/users/company/{0}').add('detail').finish();

	equal(sut.resource(666).index(), '/rest/user/666', 'Resource translates to expected path');
	equal(sut.collection(333).detail(), '/rest/users/company/333', 'Collection translates to expected path');
});

QUnit.test("The identifier from a projected Spring Data or HATEOS is resolved to its id", function(assert) {
	var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index').finish();

	equal(sut.resource({
		_links : {
			self : {
				href : 'https://localhost/rest/users/666{?projection}'
			}
		}
	}).index(), '/rest/users/666', 'Projected HATEOS object is resolved in template path');
});

QUnit.test("An exception is thrown if a resource has not been added but the resource() method is called", function(assert) {
	// build a valid instance
	var sut = new sprat.path().collectionAt('/rest').finish();
	
	try {
		sut.resource(123).detail();
		equal(true, false);
	}
	catch (ex) {
		equal(ex, "No resource path has been prior defined by using resourceAt(...)", "Exception has been thrown");
	}
});

QUnit.test("An exception is thrown if a collection has not been added but the collection() method is called", function(assert) {
	// build a valid instance
	var sut = new sprat.path().resourceAt('/rest').finish();
	
	try {
		sut.collection().detail();
		equal(true, false);
	}
	catch (ex) {
		equal(ex, "No collection path has been prior defined by using collectionAt(...)", "Exception has been thrown");
	}
});