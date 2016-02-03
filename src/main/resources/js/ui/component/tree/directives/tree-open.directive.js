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