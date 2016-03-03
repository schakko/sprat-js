describe("sprat.ui (AngularJS)", function () {
    'use strict';

    it("batchRemove removes multiple items if they are selected", function () {
        spyOn(sprat.util.array, 'removeById');

		var $items = [ {id: 1, 'selected': true}, {id: 2}, {id: 3, 'selected': true} ];
		var $service = {
			remove: function(item) {
				return {
					then: function(cb) {
						cb();
					}
				};
			},
		};

		expect(sprat.ui.batchRemove($items, $service, { confirm: function() { return true; } })).toEqual(2);
        expect(sprat.util.array.removeById).toHaveBeenCalledTimes(2);
        var callArgs = sprat.util.array.removeById.calls.first().args;
		console.log(callArgs);
        expect(callArgs[0]).toEqual($items);
        expect(callArgs[1]).toEqual($items[0].id);
    });
});
