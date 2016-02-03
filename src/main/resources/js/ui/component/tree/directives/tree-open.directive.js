/**
 * Broadcasts the message to open the path structure.<br />
 * Usage:
 * 
 * <pre>
 * &lt;tree-open path=&quot;my/tree/path&quot; /&gt;
 * </pre>
 * 
 */
angular.module('treeOpen', [])
	.directive('treeOpen', function() {
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