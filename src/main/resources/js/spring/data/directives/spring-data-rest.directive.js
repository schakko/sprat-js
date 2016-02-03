/**
 * Directive for connecting a list or table with a Spring Data REST backend
 */
angular.module('springDataRest', [])
	.directive('springDataRest', function() {
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
			 * @param page
			 *            page to load, starting with 0
			 * @param size
			 *            numeric with size of page
			 * @param sort
			 *            optional array with elements to sort
			 * @param customParameters
			 *            optional array with parameters
			 */
			var defaultPromiseFactory = function(sortParameters, customParameters) {
				if (!$scope.url) {
					throw "You must at least provide url='' parameter or a find='' callback with a method reference";
				}

				angular.merge(opts, sortParameters || {});

				return $http.get($scope.url, {
					params : opts
				}).then(function(response) {
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
					var hateoas = hateoas || undefined;
					
					$scope.refItems = [];
					$scope.refCollection = {};

					$scope.refItems = (hateoas) ? util.rest.collection(data) : data._embedded.data;
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