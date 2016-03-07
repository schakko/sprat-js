describe('BatchRemoveService', function() {
	'use strict';

	var vm, q, rootScope;
	beforeEach(function() {
		angular.mock.module('BatchRemoveServiceModule');
	});

	beforeEach(inject(function(_BatchRemoveService_, $q, $rootScope) {
		vm = _BatchRemoveService_;
		q = $q;
		rootScope = $rootScope;
	}));

	it('remove method returns a promise containing the amount of deleted items', function() {
		spyOn(sprat.util.array, 'removeById');
		var deferred = q.defer();
		var promise = deferred.promise;

		var items = [ {
			'id' : 1,
			'name' : 'Alpha',
			'selected' : false
		}, {
			'id' : 2,
			'name' : 'Beta',
			'selected' : true
		} ];

		var $service = {
			'remove' : function(item) {
				return {
					'then' : function(cb) {
						cb();
						return promise;
					}
				};
			},
		};

		deferred.resolve(1);

		var actual;
		vm.remove(items, $service, {
			'confirm' : function() {
				return true;
			},
			'afterRemove' : function(value) {
				actual = value
			}
		});

		rootScope.$apply();

		expect(sprat.util.array.removeById).toHaveBeenCalledWith(items, items[1].id);
		expect(sprat.util.array.removeById).toHaveBeenCalledTimes(1);
		expect(actual).toEqual(1);
	});

	it('remove method returns 0 if no items are selected', function() {
		spyOn(sprat.util.array, 'removeById');
		var deferred = q.defer();
		var promise = deferred.promise;

		var items = [ {
			'id' : 1,
			'name' : 'Alpha',
			'selected' : false
		}, {
			'id' : 2,
			'name' : 'Beta',
			'selected' : false
		} ];

		var $service = {
			'remove' : function(item) {
				return {
					'then' : function(cb) {
						cb();
						return promise;
					}
				};
			},
		};

		deferred.resolve(0);

		var actual;
		vm.remove(items, $service, {
			'confirm' : function() {
				return true;
			},
			'afterRemove' : function(value) {
				actual = value
			}
		});

		rootScope.$apply();

		expect(sprat.util.array.removeById).not.toHaveBeenCalled();
		expect(actual).toEqual(0);

	});
});