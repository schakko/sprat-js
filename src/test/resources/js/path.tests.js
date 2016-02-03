describe("sprat.path", function () {
    'use strict';

    it("Calling resource().index() function on '/users/1' returns the root action '/users/1'", function () {
        var sut = new sprat.path().resourceAt('/users/1').add('index').add('bla').finish();

        expect(sut.resource().index()).toEqual("/users/1");
    });

    it(
        "resource(666).index() will be inserted into resourceAt('/rest/users/{0}/detail') and resolves to '/rest/users/666/detail'",
        function () {
            var sut = new sprat.path().resourceAt('/rest/users/{0}/detail').add('index').finish();
            expect(sut.resource(666).index()).toEqual("/rest/users/666/detail");
        });

    it(
        "Assigning the sub URI '/detail' to resourceAt('/users/1') returns the full path '/users/1/detail' when calling resource().index()",
        function () {
            var sut = new sprat.path().resourceAt('/users/1').add('index', '/detail').finish();

            expect(sut.resource().index()).toEqual("/users/1/detail");
        });

    it("Assigning the sub URI 'detail' automagically adds the path separator '/' between resource and subURI", function () {
        var sut = new sprat.path().collectionAt('/rest/users').add('index', 'create').finish();

        expect(sut.collection().index()).toEqual('/rest/users/create');
    });

    it("Passing a named parameter to the sub URI is resolved", function () {
        var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={name}').finish();

        expect(sut.resource().byName({
            'name': 'ckl'
        })).toEqual("/users/1?name=ckl");
    });

    it("A missing template path parameter will be replaced by its default", function () {
        var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={name:mbi}').finish();

        expect(sut.resource().byName({})).toEqual("/users/1?name=mbi");
    });

    it("Not passing a defined named parameter results in throwing an exception", function () {
        var sut = new sprat.path().resourceAt('/users/1').add('byName', '?name={:name}');

        try {
            sut.resource().index({
                'missing_name_argument': 'ckl'
            });

            expect(false).toEqual(true);
        } catch (e) {
            expect(true).toEqual(true);
        }
    });

    it("Adding an already initialized collection fails", function () {
        try {
            var sut = new sprat.path().collectionAt('/test');
            sut.collectionsAt('/bla');

            expect(false).toEqual(true);
        } catch (e) {
            expect(true).toEqual(true);
        }
    });

    it("Calling a resource with too few arguments fails", function () {
        try {
            var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index');
            sut.index();
            expect(false).toEqual(true);
        } catch (e) {
            expect(true).toEqual(true);
        }
    });

    it("Passing a function as second argument is used as a dynamic function for resolving the path", function () {
        var sut = new sprat.path().resourceAt('/rest/users').add('index', function (state) {
            return state.root + "/EXPECTED/" + state.lastArguments[0];
        }).finish();

        expect(sut.resource().index('EXPECTED2')).toEqual('/rest/users/EXPECTED/EXPECTED2');

    });

    it("A Spring Data or HATEOS object is resolved to its id", function () {
        var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index').finish();

        expect(sut.resource({
            _links: {
                self: {
                    href: 'https://localhost/rest/users/666'
                }
            }
        }).index()).toEqual('/rest/users/666');
    });

    it("Assigning resource and collection mappings in one fluent call is possible", function () {
        var sut = new sprat.path().resourceAt('/rest/user/{0}').add('index').finish().collectionAt(
            '/rest/users/company/{0}').add('detail').finish();

        expect(sut.resource(666).index()).toEqual('/rest/user/666');
        expect(sut.collection(333).detail()).toEqual('/rest/users/company/333');
    });

    it("The identifier from a projected Spring Data or HATEOS is resolved to its id", function () {
        var sut = new sprat.path().resourceAt('/rest/users/{0}').add('index').finish();

        expect(sut.resource({
            _links: {
                self: {
                    href: 'https://localhost/rest/users/666{?projection}'
                }
            }
        }).index()).toEqual('/rest/users/666');
    });

    it("An exception is thrown if a resource has not been added but the resource() method is called", function () {
        // build a valid instance
        var sut = new sprat.path().collectionAt('/rest').finish();

        try {
            sut.resource(123).detail();
            expect(true).toEqual(false);
        }
        catch (ex) {
            expect(ex).toEqual("No resource path has been prior defined by using resourceAt(...)");
        }
    });

    it("An exception is thrown if a collection has not been added but the collection() method is called", function () {
        // build a valid instance
        var sut = new sprat.path().resourceAt('/rest').finish();

        try {
            sut.collection().detail();
            expect(true).toEqual(false);
        }
        catch (ex) {
            expect(ex).toEqual("No collection path has been prior defined by using collectionAt(...)");
        }
    });

});