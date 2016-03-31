// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('BatchRemoveServiceModule');
} catch (ex) {
	module = angular.module('BatchRemoveServiceModule', []);
}

module.service('BatchRemoveService', BatchRemoveService, [ '$q' ]);

function BatchRemoveService($q) {
	var vm = this;

	vm.remove = function($items, $service, $opts) {
		var toRemove = [];

		// default options
		var opts = {
			confirm : function(items) {
				return confirm("Sollen " + items.length
						+ " Einträge gelöscht werden?");
			},
			lookupMethod : function(item) {
				if (item.id === undefined) {
					throw "You must provide the .id property in each item of the provided $items array";
				}

				return item.selected === true;
			},
			afterRemove : function(totalRemoved) {
			}
		};

		if (angular.isFunction($opts)) {
			opts.confirm = $opts;
		}

		if (angular.isObject($opts)) {
			// merge custom options with default options
			angular.merge(opts, $opts);
		}

		// lookup items to delete
		sprat.util.lookup($items, opts.lookupMethod, function(elem) {
			toRemove.push(elem);
		});

		// ask for confirmation
		if (toRemove.length <= 0 || !opts.confirm(toRemove)) {
			opts.afterRemove(0);
		}

		var requests = [];
		var totalRemoved = 0;

		for (var i = 0, m = toRemove.length; i < m; i++) {
			//using closure to prevent referencing of last value in callback
			(function(item) {
				/* jshint -W083 */
				requests.push($service.remove(item).then(function(data) {
					totalRemoved++;
					sprat.util.array.removeById($items, item.id);
				}));
			})(toRemove[i]);
		}

		$q.all(requests).then(function() {
			$opts.afterRemove(totalRemoved);
		});

	};

}