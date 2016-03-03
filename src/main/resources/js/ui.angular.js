var sprat = sprat || {};
sprat.ui = sprat.ui || {};

/**
 * Executes the method "remove" on the given $service. By default, every item in the $items array is scheduled to delete, if the "selected" property is set to true.
 * The behavior can be customized by overwriting the $opts parameter.
 *
 * @author ckl
 * @param $items array with AngularJS binding 
 * @param $service an AngularJS service providing the $service.remove method
 * @param $opts function|null|object callback before the removement is executed. If $opts is a function, this function is used as a confirm handler. By default, a simple confirm window pops up
 *				The following properties can be used for customizing: .confirm($items): true|false, .lookupMethod(item): true|false
 */
sprat.ui.batchRemove = function($items, $service, $opts) {
	var toRemove = [];
	
	// default options
	var opts = {
		confirm: function(items) {
			return confirm("Sollen " + items.length + " Einträge gelöscht werden?");
		},
		lookupMethod: function(item) {
			if (item.id === undefined) {
				throw "You must provide the .id property in each item of the provided $items array";
			}
			
			return item.selected === true;
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
		return 0;
	}

	for (var i = 0, m = toRemove.length; i < m; i++) {
		var item = toRemove[i];

		/*jshint -W083 */
		$service.remove(item).then(function(data) {
			sprat.util.array.removeById($items, item.id);
		});
	}
	
	return toRemove.length;
};
