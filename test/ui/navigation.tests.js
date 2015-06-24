QUnit.module("sprat.ui.navigation.actions");
QUnit.test("Forgetting .title or .url results in an exception", function(assert) {
	try {
		var sut = sprat.ui.navigation.actions.create([{
			icon: "my-icon"
		}]);
		
		// guard
		equal(true, false);
	}
	catch (ex) {
		equal(true, true, "exception has been thrown");
	}
});

QUnit.test("A valid action item can be accessed by its index", function(assert) {
	var sut = sprat.ui.navigation.actions.create([{
		icon: "my-icon",
		title: "Titel",
		url: "localhost"
	}]);
	
	notEqual(sut, undefined, "sut must be defined");
	equal(sut.actions.length, 1);
	equal(sut.actions[0].icon, "my-icon", "icon is accessible");
	equal(sut.actions[0].title, "Titel", "title is accessible");
	equal(sut.actions[0].url, "localhost", "URL is accessible");
});

QUnit.test("A valid action can be printed", function(assert) {
	var sut = sprat.ui.navigation.actions.create([{
		icon: "my-icon",
		title: "Titel",
		url: "localhost"
	}]).toString();
	
	equal(sut, "<a href='localhost'><button class='btn btn-default'><i class='fa fa-my-icon'></i> Titel</button></a>", "printed string is expected");
});

QUnit.test("Multiple actions are concatenated when printed", function(assert) {
	var sut = sprat.ui.navigation.actions.create([{
		icon: "my-icon",
		title: "Titel",
		url: "localhost"
	}, {
		icon: "my-icon2",
		title: "Titel2",
		url: "localhost2"
	}]).toString();
	
	equal(sut, "<a href='localhost'><button class='btn btn-default'><i class='fa fa-my-icon'></i> Titel</button></a><a href='localhost2'><button class='btn btn-default'><i class='fa fa-my-icon2'></i> Titel2</button></a>", "printed string is expected");
});

QUnit.test("An action without an icon is printed without an icon", function(assert) {
	var sut = sprat.ui.navigation.actions.create([{
		icon: null,
		title: "Titel",
		url: "localhost"
	}]).toString();
	
	equal(sut, "<a href='localhost'><button class='btn btn-default'>Titel</button></a>", "printed string is expected");
});

QUnit.test("Only whitelisted/restricted actions are printed if an array is provided", function(assert) {
	var sut = sprat.ui.navigation.actions.create([{
		title: "Titel",
		url: "localhost",
		alias: "whitelisted-only"
	}, {
		title: "Titel2",
		url: "localhost2"
	}]).toString(["whitelisted-only"]);
	
	equal(sut, "<a href='localhost'><button class='btn btn-default'>Titel</button></a>", "only the whitelisted string is printed");
});

QUnit.module("sprat.ui.navigation.menu");
QUnit.test("Traversing #menu-accounts-overview activates parent leafs up to the root node", function (assert) {
	// ref:#qunit-fixture > div#sprat-ui-navigation-menu
	sprat.ui.navigation.menu.traverse("#menu-accounts-overview");
	
	equal(true, $("#menu-accounts-overview").hasClass("active"), "selected menu entry is active");
	equal(false, $("#menu-accounts-invite").hasClass("active"), "other menu entry on same level with selected menu entry is *not* active");
	equal(true, $(".menu-accounts").hasClass("active"), "parent node is active");
	equal(false, $("#menu-dashboard").hasClass("active"), "node on same level with root node is *not* active");
});

// QUnit.module("other namespace/group of sprat.ui.js to test")
