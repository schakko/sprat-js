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