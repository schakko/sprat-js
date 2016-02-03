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