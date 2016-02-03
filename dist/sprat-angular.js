// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('springDataRest');
}catch (ex) {
	module = angular.module('springDataRest', []);
}

/**
 * Directive for connecting a list or table with a Spring Data REST backend
 */
module.directive('springDataRest', function() {
	return {
		restrict : 'E', 		// element tag only
		transclude : true, 		// spring-data-rest is a container
		scope : { 				// custom scope without access to parent
			'promiseFactory' : '=', // nullable method reference to use for creating the $http request
			'url' : '=url', 		// if findCallback is empty, use this string to set the REST endpoint
			'refSort' : '=sort', 	// reference to sort parameter
			'refParams' : '=params', // reference to any other parameter
			'size' : '=size',		// default size of page
			'refCollection' : '=collection', // reference to the native Spring Data REST collection
			'refItems' : '=items', 	// reference to the items of the collection itself
			'disableInit' : '=', 	// disable initialization, meaning no initial data is loaded
			'listenerId' : '@',		// if this value is given, the directive listens to the "$listenerId:reload" event to trigger a reload of the dataset
		},
		link : function(scope, element, attrs) {
			attrs.$observe('init', function() {
				scope.init = scope.$eval(attrs.init);
			});
			
			// enable listening to events
			if (attrs.listenerId) {
				scope.$on(attrs.listenerId + ":reload", function() {
					scope.reload();
				});
			}
		},
		controller : [ '$scope', '$http', function($scope, $http) {
			var vm = this;

			// array with available pages
			$scope.pages = [];
			// current selected page; initialized with '0' b/c of AngularJS
			// comparing
			$scope.currentPage = '0';
			// use util.rest.collection to extract the response data
			$scope.extractContent = false;

			/**
			 * trigger loading of first page
			 */
			$scope.first = function() {
				vm.load(0);
			};

			/**
			 * trigger loading of last page
			 */
			$scope.last = function() {
				vm.load($scope.refCollection.page.totalPages - 1);
			};

			/**
			 * trigger loading of page
			 * 
			 * @param int
			 *            n first page is 0
			 */
			$scope.page = function(page) {
				vm.load(page);
			};

			/**
			 * trigger loading of previous page
			 */
			$scope.previous = function() {
				vm.load(vm.currentPage() - 1);
			};

			/**
			 * trigger loading of next page
			 */
			$scope.next = function() {
				vm.load(vm.currentPage() + 1);
			};

			/**
			 * trigger reload of the current page
			 */
			$scope.reload = function() {
				vm.reload();
			};

			/**
			 * default factory method for creating a new promise if only a
			 * custom URL is specified without a custom finder
			 * 
			 * @param queryParameters object with keys for sort, size, page
			 * @param httpParameters custom HTTP parameter for $http.*
			 */
			var defaultPromiseFactory = function(queryParameters, httpCustomParameters) {
				if (!$scope.url) {
					throw "You must at least provide url='' parameter or a find='' callback with a method reference";
				}

				var httpCustomParameters = httpCustomParameters || {};
				httpCustomParameters.params = {};
				
				angular.merge(httpCustomParameters.params, queryParameters);

				return $http.get($scope.url, httpCustomParameters).then(function(response) {
					return response.data;
				});
			};

			/**
			 * set current sorting
			 */
			vm.setSorting = function(sort) {
				$scope.refSort = sort;
			};

			/**
			 * trigger the reload of the page. This method can be called from
			 * outside (e.g. inner directives)
			 */
			vm.reload = function() {
				vm.load(vm.currentPage());
			};

			/**
			 * get the current page. Spring Data REST's pages begin at 0.
			 * 
			 * @return numeric
			 */
			vm.currentPage = function() {
				var page = 0;

				if ($scope.refCollection && $scope.refCollection.page) {
					page = $scope.refCollection.page.number;
				}

				return page;
			};

			/**
			 * Create the request parameters for the promise
			 * 
			 * @param page
			 *            number, starting with 0
			 * @return object which is passed to $.promise(url, { params:
			 *         $_THIS_ })
			 */
			vm.createRequestParameters = function(page) {
				var opts = {
					size : $scope.size || null,
					page : page,
					sort : $scope.refSort
				};

				return angular.merge({}, $scope.refParams || {}, opts);
			};

			/**
			 * trigger loading of the page
			 * 
			 * @param page
			 *            numeric, starting with page 0
			 */
			vm.load = function(page) {
				var promiseFactory = defaultPromiseFactory;

				// if find='method' has specified, use the specfied method for
				// defining the promise
				if ($scope.promiseFactory) {
					promiseFactory = $scope.promiseFactory;
				}

				// notify child element
				$scope.$root.$broadcast('spring-data-rest.begin-fetch', page);

				var requestParameters = vm.createRequestParameters(page);

				// initalize promise
				promiseFactory(requestParameters).then(function(data) {
					$scope.refItems = [];
					$scope.refCollection = {};

					$scope.refItems = (typeof($hateoas) !== 'undefined') ? $hateoas.embedded(data) : data._embedded.data;
					$scope.refCollection = data;

					$scope.pages = [];

					// update current select page
					$scope.currentPage = '' + page;

					for (var i = 0, m = $scope.refCollection.page.totalPages; i < m; i++) {
						$scope.pages.push(i);
					}

					// notify child element
					$scope.$root.$broadcast('spring-data-rest.end-fetch', page, $scope.refItems.length);
				});
			};

			function activate() {
				if (!$scope.disableInit) {
					vm.load($scope.currentPage)
				}
			}

			activate();
		} ],
		template : '<div ng-transclude></div>'
	}
});
// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('springDataRest');
}catch (ex) {
	module = angular.module('springDataRest', []);
}

/**
 * Default directive for a simple pagination
 */
module.directive('springDataRestPagination', function() {
	return {
		require: '^springDataRest',
		transclude: false, 	// disable inner content
		scope: false,
		template: 
			"<span ng-show='$parent.refCollection.page.totalPages > 0 && $parent.refCollection.page.number != 0'><a href='#' ng-click='$parent.first()'>Erste Seite</a> | </span>"
					+ "<span ng-show='$parent.refCollection.page.number > 0'><a href='#' ng-click='$parent.previous()', >&lt; Vorher</a> | </span>"
					+ "<select ng-change='$parent.page($parent.currentPage)' ng-model='$parent.currentPage'><option ng-repeat='n in $parent.pages' value='{{n}}' ng-selected='n == $parent.currentPage'>Seite {{n + 1}}</option></select>"
					+ "<span ng-show='($parent.refCollection.page.number + 1) < $parent.refCollection.page.totalPages'> | <a href='#' ng-click='$parent.next()'>Nächste &gt;</a></span> "
					+ "<span ng-show='$parent.refCollection.page.totalPages'>| <a href='#' ng-click='$parent.last()'>Letzte Seite</a></span>"
	};
});
// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('springDataRest');
}catch (ex) {
	module = angular.module('springDataRest', []);
}

/**
 * Enables the sorting of columns.
 * <br />
 * usage: <pre>
 * 	<span ng-click="toggleDirection()" spring-data-rest-sort="sdr" property="name" default-direction="desc" is-default="true">Name</span>
 * </pre>
 */
module.directive('springDataRestSort', function() {
	return {
		restrict: 'A', 		// attribute tag only; using E with transclude scope does not allow the access to toggleDirection() inside the directive
		scope: true, 		// activate access to parent scope
		require: '^springDataRest',
		link: function(scope, element, attrs, springDataRestController) {
			scope.springDataRestController = springDataRestController;

			// 'property' attribute is required
			if (!attrs.property) {
				throw "Attribute 'property' is required";
			}
			
			scope.property = attrs.property;
			
			// 'default-direction' is optional. If not given, it defaults to 'asc'
			if (attrs.defaultDirection) {
				var direction = attrs.defaultDirection.toLowerCase();
				scope.direction = direction == 'desc' ? direction : 'asc';
			}
			
			// 'is-default' initializes the table
			if (attrs.isDefault) {
				scope.refresh();
			}
		},
		controller: ['$scope', '$http', function($scope, $http) {
			var vm = this;
			
			/**
			 * initiates the refresh with the sorting of the current scope 
			 */
			$scope.refresh = function()  {
				var sort = $scope.property;
				
				if ($scope.direction) {
					sort += "," + $scope.direction;
				}
				
				$scope.springDataRestController.setSorting(sort);
				$scope.springDataRestController.reload();
			};
			
			/**
			 * toggles the direction
			 * @param noUpdate if true, a refresh of the table is *not* initiated
			 */
			$scope.toggleDirection = function(noRefresh) {
				var direction = 'asc';
				
				if ($scope.direction == 'asc') {
					direction = 'desc';
				}
				
				$scope.direction = direction;
				
				if (!noRefresh) {
					$scope.refresh();
				}
			};
			
			function activate() {
			};
			
			activate();
		}]
	}
});
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
		return false;
	}

	for (var i = 0, m = toRemove.length; i < m; i++) {
		var item = toRemove[i];

		/*jshint -W083 */
		$service.remove(item).then(function(data) {
			sprat.util.array.removeById($items, item.id);
		});
	}
	
	return true;
};

var sprat = sprat || {};
sprat.ui = sprat.ui || {};
sprat.ui.validation = sprat.ui.validation || {};

/**
 * Utility methods for validation of AngularJS backed forms and Spring Data * backends
 */

/**
 * Removes any AngularJS error from the $form
 * @param $form AngularJS binding to the form
 * @param $errors AngularJS binding for errors
 * @param _fieldMapping object|null
 */
sprat.ui.validation.resetErrors = function($form, $errors, _fieldMapping) {
	var field = null;
	
	_fieldMapping = _fieldMapping || [];

	// reset existing errors
	for (var key in $errors) {
		field = key;
		
		if (_fieldMapping[field]) {
			field = _fieldMapping[field];
		}
		
		$form[field].$setValidity('server', true);
		
		delete $errors[field];
	}
};

/**
 * parses errors from the backend
 * @param $form AngularJS binding to the form
 * @param $errors AngularJS binding to the errors
 * @param data retrieved validation data from the backend
 * @param _fieldMapping object|null
 */
sprat.ui.validation.parseErrors = function($form, $errors, data, _fieldMapping) {
	_fieldMapping = _fieldMapping || [];
	
	sprat.ui.validation.resetErrors($form, $errors, _fieldMapping);
	
	var error = null, field = null, code = null, message = null;
	
	if (data.errors) {
		// append new errors
		for (var idx in data.errors) {
			error = data.errors[idx];
			field = error.field;
			
			if (_fieldMapping[field]) {
				field = _fieldMapping[field];
			}
			
			code = error.code
			message = error.defaultMessage || code;
			
			$errors[field] = message;
			$form[field].$setValidity('server', false)
		}
	}
};
// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('tree');
}catch (ex) {
	module = angular.module('tree', []);
}

/**
 * Broadcasts the message to open the path structure.<br />
 * Usage:
 * 
 * <pre>
 * &lt;tree-open path=&quot;my/tree/path&quot; /&gt;
 * </pre>
 * 
 */
module.directive('treeOpen', function() {
	return {
		restrict : 'E',
		scope : {
			path : '@'
		},
		link : function(scope, element, attrs) {
			scope.$root.$broadcast('open-tree-path', scope.path);
		}
	};
});
// retrieve or create the module namespace
var module = undefined || module;

try {
	module = angular.module('tree');
}catch (ex) {
	module = angular.module('tree', []);
}

/**
 * Sets a menu tree path of a given element. If the broadcast "open-tree-path" is received, 
 * the directive decides whether to add the CSS class "active" or remove it.
 */
module.directive('treePath', function() {
	return {
		restrict : 'A',
		scope : {
			treePath: '@'
		},
		link : function(scope, element, attrs) {
			scope.$on('open-tree-path', function(event, args_path) {
				var is_itself = (args_path == scope.treePath);
				var is_parent = args_path.slice(0, scope.treePath.length) == scope.treePath
				
				if (is_itself || is_parent) {
					element.addClass('active');
				}
				else {
					element.removeClass('active');
				}
			})
		}
	};
});