describe("sprat.ui.navigation", function () {
    'use strict';

    it("Forgetting .title or .url results in an exception", function () {
        var object = [{
            icon: "my-icon"
        }];
        try {
            var sut = sprat.ui.navigation.actions.create(object);

            // guard
            expect(true).toEqual(false);
        }
        catch (ex) {
            expect(ex).toEqual('You must provide an .title and an .url attribute for the action ' + object);
        }
    });

    it("A valid action item can be accessed by its index", function () {
        var object = [{
            icon: "my-icon",
            title: "Titel",
            url: "localhost"
        }];
        var sut = sprat.ui.navigation.actions.create(object);
        expect(sut).toBeDefined();
        expect(sut.actions.length).toEqual(1);
        expect(sut.actions[0].icon).toEqual('my-icon');
        expect(sut.actions[0].title).toEqual('Titel');
        expect(sut.actions[0].url).toEqual('localhost');
    });

    it("A valid action can be printed", function () {
        var object = [{
            icon: "my-icon",
            title: "Titel",
            url: "localhost"
        }];
        var sut = sprat.ui.navigation.actions.create(object).toString();

        expect(sut).toEqual("<a href='localhost'><button class='btn btn-default'><i class='fa fa-my-icon'></i> Titel</button></a>");
    });

    it("Multiple actions are concatenated when printed", function () {
        var object = [{
            icon: "my-icon",
            title: "Titel",
            url: "localhost"
        }, {
            icon: "my-icon2",
            title: "Titel2",
            url: "localhost2"
        }];

        var sut = sprat.ui.navigation.actions.create(object).toString();

        expect(sut).toEqual("<a href='localhost'><button class='btn btn-default'><i class='fa fa-my-icon'></i> Titel</button></a><a href='localhost2'><button class='btn btn-default'><i class='fa fa-my-icon2'></i> Titel2</button></a>");
    });

    it("An action without an icon is printed without an icon", function () {
        var object = [{
            icon: null,
            title: "Titel",
            url: "localhost"
        }];
        var sut = sprat.ui.navigation.actions.create(object).toString();

        expect(sut).toEqual("<a href='localhost'><button class='btn btn-default'>Titel</button></a>");
    });

    it("Only whitelisted/restricted actions are printed if an array is provided", function () {
        var object = [{
            title: "Titel",
            url: "localhost",
            alias: "whitelisted-only"
        }, {
            title: "Titel2",
            url: "localhost2"
        }];

        var sut = sprat.ui.navigation.actions.create(object).toString(["whitelisted-only"]);

        expect(sut).toEqual("<a href='localhost'><button class='btn btn-default'>Titel</button></a>");
    });

    it("Traversing #menu-accounts-overview activates parent leafs up to the root node", function () {
		// running Grunt and Maven parallel does not work b/c Maven sets the base path to /spec so we can not load any fixture
		setFixtures('<div id="sprat-ui-navigation-menu"> \
        <!-- Sample for AdminLTE --> \
        <aside class="main-sidebar"> \
            <section class="sidebar" style="height: auto;"> \
                <ul class="sidebar-menu"> \
                    <li class="header">Dashboard</li> \
                    <li class="menu-accounts treeview"> \
                        <a href="#"><i class="fa fa-key"></i> \
                            <span>Accounts</span> <i class="fa fa-angle-left pull-right"></i> \
                        </a> \
                        <ul class="treeview-menu" navigation-parent-item=".menu-accounts"> \
                            <li id="menu-accounts-overview"> \
                                <a href="/users/overview">Overview</a> \
                            </li> \
                            <li id="menu-accounts-invite"> \
                                <a href="/users/invite">Invite user</a> \
                            </li> \
                        </ul> \
                    </li> \
                    <!--/.sidebar-menu --> \
                </ul> \
            </section> \
        </aside> \
    </div>');
	
        sprat.ui.navigation.menu.traverse("#menu-accounts-overview");

        expect(true).toEqual($("#menu-accounts-overview").hasClass("active"));
        expect(false).toEqual($("#menu-accounts-invite").hasClass("active"));
        expect(true).toEqual($(".menu-accounts").hasClass("active"));
        expect(false).toEqual($("#menu-dashboard").hasClass("active"));
    });
});