describe("sprat.web.uri.parse", function () {

    it("Named parameter is replaced", function () {
        var result = sprat.web.uri.parse('https://localhost/rest/users/{id}', {id: 666});

        expect(result).toEqual("https://localhost/rest/users/666");
    });

    it("{?projection} is removed from result set if not passed", function () {
        var result = sprat.web.uri.parse('https://localhost/rest/users/666{?projection}');

        expect(result).toEqual("https://localhost/rest/users/666");
    });

    it("'?name={name:mbi}' falls back to default value if not passed", function () {
        var result = sprat.web.uri.parse('https://localhost/rest/users/666?name={name:mbi}');

        expect(result).toEqual("https://localhost/rest/users/666?name=mbi");
    });

    it("{?projection} is replaced if passed as argument", function () {
        var result = sprat.web.uri.parse('https://localhost/rest/users/666{?projection}', ["projection"]);

        expect(result).toEqual("https://localhost/rest/users/666?projection");
    });
});


describe("sprat.web.hateoas.relation", function () {

    it("a links relation can be found", function () {
        var object = {
            links: {
                '$rel': '$url'
            }
        };

        expect($hateoas.relation(object, '$rel')).toEqual('$url');
    });

    it("a links relation can be found inside an object", function () {
        var object = {
            _links: {
                '$rel': {href: '$url'}
            }
        };

        expect($hateoas.relation(object, '$rel')).toEqual('$url');
    });

    it("a _links relation can be found", function () {
        var object = {
            _links: {
                '$rel': '$url'
            }
        };

        expect($hateoas.relation(object, '$rel')).toEqual('$url');
    });

    it("a links relation with .rel and .href can be found", function () {
        var object = {
            links: [
                {
                    rel: '$rel',
                    href: '$url'
                }
            ]
        };

        expect($hateoas.relation(object, '$rel')).toEqual('$url');
    });

    it("a links relation with .rel and .rel.href can be found", function () {
        var object = {
            links: [
                {
                    $rel: {
                        href: '$url'
                    }
                }
            ]
        };

        expect($hateoas.relation(object, '$rel')).toEqual('$url');
    });

});

describe("sprat.web.hateoas.embedded", function () {

    it("the _embedded object returns the encapsulated page", function () {
        var object = {
            _embedded: {
                customers: [1]
            }
        };

        expect($hateoas.embedded(object)).toEqual(object._embedded.customers);
    });
});

describe("sprat.web.hateoas.constraints", function () {

    it("the constraint 'delete' can be found in constraints", function () {
        var object = {
            constraints: {
                delete: [
                    {
                        id: 111
                    }
                ]
            }
        };

        var actual = $hateoas.constraints(object, 'delete');
        expect(actual.length).toEqual(1);
        expect(actual[0]).toEqual({id: 111});
    });

    it("the constraint 'delete' can be found in _constraints", function () {
        var object = {
            _constraints: {
                delete: [
                    {
                        id: 222
                    },
                    {
                        id: 333
                    },
                    {
                        id: 444
                    }
                ]
            }
        };

        var actual = $hateoas.constraints(object, 'delete');
        expect(actual.length).toEqual(3);
        expect(actual[0]).toEqual({id: 222});
        expect(actual[1]).toEqual({id: 333});
        expect(actual[2]).toEqual({id: 444});
    });

    it("an expection will be thrown because the object is invalid", function () {
        var object = {};

        expect(function () {
            $hateoas.constraints(object, 'delete');
        }).toThrow('Invalid HATEOAS object without .constraints');
    });

    it("an expection will be thrown because the constraint 'delete' does not exist", function () {
        var object = {
            constraints: {
                somethingCompletelyDifferent: [
                    {
                        id: 111
                    }
                ]
            }
        };

        expect(function () {
            $hateoas.constraints(object, 'delete');
        }).toThrow("HATEOAS constraint with name 'delete' does not exist");
    });
});