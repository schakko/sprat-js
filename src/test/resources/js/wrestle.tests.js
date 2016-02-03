describe("sprat.wrestle", function () {
    'use strict';

    it("sprat.wrestle.updatePipes uses default config if no success callbacks are provided", function () {
        var r = sprat.wrestle.updatePipes(undefined, undefined, {});
        expect(sprat.wrestle.configuration.defaults.success().length).toEqual(r.pipes.success.length);
        expect(sprat.wrestle.configuration.defaults.fail().length).toEqual(r.pipes.fail.length);
    });

    it("sprat.wrestle.updatePipes uses success callbacks", function () {
        var r = sprat.wrestle.updatePipes([function () {
            return "test";
        }], undefined, {});
        expect(1).toEqual(r.pipes.success.length);
        expect(sprat.wrestle.configuration.defaults.fail().length).toEqual(r.pipes.fail.length);
        expect("test").toEqual(r.pipes.success[0]());
    });

    it("sprat.wrestle.updatePipes uses error callbacks", function () {
        var r = sprat.wrestle.updatePipes([function () {
            return "test";
        }], function () {
            return "error";
        }, {});
        expect(r.pipes.fail.length).toEqual(1);
        expect("error").toEqual(r.pipes.fail[0]());
    });

    it("$.restGet maps to sprat.wrestle._delegateSimpleRequest", function () {
        spyOn(sprat.wrestle, '_delegateSimpleRequest');

        $rest.get('any', {});

        expect(sprat.wrestle._delegateSimpleRequest).toHaveBeenCalled();
    });

    it("_delegateSimpleRequest(url) is valid", function () {
        //var mock = sinon.mock(sprat.wrestle);
        spyOn(sprat.wrestle, 'call');

        sprat.wrestle._delegateSimpleRequest(['https://my_url'], "GET");

        expect(sprat.wrestle.call).toHaveBeenCalled();
        expect(sprat.wrestle.call.calls.count()).toEqual(1);

        var callArgs = sprat.wrestle.call.calls.first().args;
        expect(callArgs[0]).toEqual('https://my_url');
        expect(callArgs[1]).toEqual(null);
        expect(callArgs[2]).toEqual('GET');
    });

    it("$.get(_url, data: {}) is valid", function () {
        spyOn(sprat.wrestle, 'call');

        $rest.get('any', {
            key: 'value'
        });

        expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);

        var callArgs = sprat.wrestle.call.calls.first().args;
        expect(callArgs[0]).toEqual('any');
        expect(callArgs[1]).toEqual({key: 'value'});
        expect(callArgs[2]).toEqual('GET');
    });

    it("$.get(_url, data: {}, function success() {}) is valid", function () {
        spyOn(sprat.wrestle, 'call');

        $rest.get('any', {
            key: 'value'
        }, function () {
            return "EXPECTED";
        });

        var callArgs = sprat.wrestle.call.calls.first().args;

        expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);
        expect(callArgs[0]).toEqual('any');
        expect(callArgs[1].key).toEqual('value');
        expect(callArgs[2]).toEqual('GET');
        expect(callArgs[3].pipes.success.length).toEqual(1);
        expect(callArgs[3].pipes.success[0]()).toEqual("EXPECTED");
    });

    it("$.get(_url, data: {}, [function success() {}, function success2(){}]) is valid", function () {
        spyOn(sprat.wrestle, 'call');

        $rest.get('any', {
            key: 'value'
        }, [function () {
            return "EXPECTED";
        }, function () {
            return "EXPECTED2";
        }]);

        var callArgs = sprat.wrestle.call.calls.first().args;

        expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);
        expect(callArgs[0]).toEqual('any');
        expect(callArgs[1].key).toEqual('value');
        expect(callArgs[2]).toEqual('GET');
        expect(callArgs[3].pipes.success.length).toEqual(2);
        expect(callArgs[3].pipes.success[0]()).toEqual("EXPECTED");
    });

    it("$.get(_url, data: {}, [function success() {}, function success2(){}], function error() {}) is valid",
        function () {
            spyOn(sprat.wrestle, 'call');

            $rest.get('any', {
                key: 'value'
            }, [function () {
                return "EXPECTED";
            }, function () {
                return "EXPECTED2";
            }], function () {
                return "EXPECTED_ERROR";
            });

            var callArgs = sprat.wrestle.call.calls.first().args;

            expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);

            expect(callArgs[0]).toEqual('any');
            expect(callArgs[1].key).toEqual('value');
            expect(callArgs[2]).toEqual('GET');
            expect(callArgs[3].pipes.fail.length).toEqual(1);
            expect(callArgs[3].pipes.fail[0]()).toEqual("EXPECTED_ERROR");

        });

    it("$.get(_url, [ function success() {}]) is valid", function () {
        spyOn(sprat.wrestle, 'call');

        $rest.get('any', function () {
            return "EXPECTED";
        });

        var callArgs = sprat.wrestle.call.calls.first().args;

        expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);
        expect(callArgs[0]).toEqual('any');
        expect(callArgs[1]).toEqual(null);
        expect(callArgs[2]).toEqual('GET');
        expect(callArgs[3].pipes.success.length).toEqual(1);
        expect(callArgs[3].pipes.success[0]()).toEqual("EXPECTED");

    });

    it(
        "$.get(_url, data: {}, [function success() {}, function success2(){}], [function error() {}, function error2() {}) is valid",
        function () {
            spyOn(sprat.wrestle, 'call');

            $rest.get('any', {
                key: 'value'
            }, [function () {
                return "EXPECTED";
            }, function () {
                return "EXPECTED2";
            }], [function () {
                return "EXPECTED_ERROR";
            }, function () {
                return "EXPECTED_ERROR2";
            }]);

            var callArgs = sprat.wrestle.call.calls.first().args;

            expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);
            expect(callArgs[0]).toEqual('any');
            expect(callArgs[1].key).toEqual('value');
            expect(callArgs[2]).toEqual('GET');
            expect(callArgs[3].pipes.fail.length).toEqual(2);
            expect(callArgs[3].pipes.fail[1]()).toEqual("EXPECTED_ERROR2");
        });

    it("$.get(_url, data: {}, context: {}) is valid for overwriting $.ajax options", function () {
        spyOn(sprat.wrestle, 'call');

        $rest.get('any', {
            key: 'value'
        }, {
            ajax: {
                datatype: "text test"
            }
        });

        var callArgs = sprat.wrestle.call.calls.first().args;

        expect(sprat.wrestle.call).toHaveBeenCalledTimes(1);
        expect(callArgs[3].ajax.datatype).toEqual("text test");
    });

    it("Profiles can be configured", function () {
        spyOn(sprat.wrestle, 'call');

        var profile = {
            fail: [function () {
                return "EXPECTED";
            }]
        };

        sprat.wrestle.configuration.profiles.add('my_profile', profile);

        $rest.get('any', null, {
            'profile': 'my_profile'
        });

        var callArgs = sprat.wrestle.call.calls.first().args;

        expect(callArgs[3].pipes.success.length).toEqual(0);
        expect(callArgs[3].pipes.fail[0]()).toEqual("EXPECTED");
    });

    it("GET data is not serialized but added as JSON object to $.ajax({data: ... })", function () {
        spyOn($, 'ajax').and.callFake(function (req) { return { always: function() {}}; });

        $rest.get('any', {
            key: 'value'
        });

        expect($.ajax.calls.first().args[0].data.key).toEqual('value');
    });

    it("POST data must be serialized passed to $.ajax({data: ... })", function () {
        spyOn($, 'ajax').and.callFake(function (req) { return { always: function() {}}; });

        $rest.post('any', {
            key: 'value'
        });

        expect(typeof ($.ajax.calls.first().args[0].data)).toEqual('string');
    });

    it("always.successForHttpHeaderBetween200And399 runs pipes.success if status code is 200", function () {
        var isCalled = false;

        new sprat.wrestle.pipes.always.successForHttpHeaderBetween200And399()({
            status: 200,
            readyState: 200,
            responseText: "OK"
        }, null, null, {
            pipes: {
                success: [function () {
                    isCalled = true;
                }]
            }
        });

        expect(isCalled).toEqual(true);
    });

    it("always.fallbackToFail is executed as firstResponseHandler and executes custom error handler", function () {
        var isCalled = false;

        sprat.wrestle.run(sprat.wrestle.configuration.firstResponseHandlers(), {
            status: 400,
            readyState: 400,
            responseText: "FAIL"
        }, null, null, {
            pipes: {
                fail: [function () {
                    isCalled = true;
                }]
            }
        });

        expect(isCalled).toEqual(true);
    });

    it("Pipes are no longer executed if pipe returns true", function () {
        var firstIsCalled = false;
        var secondIsCalled = false;

        sprat.wrestle.run([function () {
            firstIsCalled = true;
            return true;
        }, function () {
            secondIsCalled = true;
            return "LA";
        }]);

        expect(firstIsCalled).toEqual(true);
        expect(secondIsCalled).toEqual(false);
    });

    it("Following pipes are executed if function returns nothing", function () {
        var firstIsCalled = false;
        var secondIsCalled = false;

        sprat.wrestle.run([function () {
            firstIsCalled = true;
        }, function () {
            secondIsCalled = true;
        }]);

        expect(firstIsCalled).toEqual(true);
        expect(secondIsCalled).toEqual(true);
    });
});