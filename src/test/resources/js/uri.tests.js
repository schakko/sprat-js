describe("sprat.uri", function () {
    'use strict';

    it("a GET-parameter can be extracted", function () {
        var search="?a=1&b=2";

        expect(sprat.uri.requestParameter('b', search)).toEqual('2');
    });

});
