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