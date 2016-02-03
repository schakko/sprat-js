/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.navigation = sprat.ui.navigation || {};

sprat.ui.navigation.actions = {
	/**
	 * Create navigation buttons for table list views.
	 * Use sprat.ui.navigation.actions.create([...]).toString() to print out the actions.
	 * @param {array} actions Array of actions
	 */
	create : function(actions) {
		if (!jQuery.isArray(actions)) {
			throw "Argument is not an array";
		}
		
		jQuery.each(actions, function(idx, item) {
			if (!item.title || !item.url) {
				throw "You must provide an .title and an .url attribute for the action " + item;
			}
		});
		
		var result  = function(actions) {
			var self = this;
			self.actions = actions;
			
			/**
			 * Return a concatenated string with the requested actions.
			 * @param {array|null} _restrictActions If a valid array is given, only actions are concatted with matching .alias attributes
			 * @return {string}
			 */
			self.toString = function(_restrictActions) {
				var r = "", idx = null;
				
				var restrictActions = {
					_isRestricted: false
				};
				
				// build lookup table of actions are restricted
				if (jQuery.isArray(_restrictActions)) {
					restrictActions._isRestricted = true;
					
					for (idx in _restrictActions) {
						var restrictedAction = _restrictActions[idx];
						restrictActions[restrictedAction] = restrictedAction;
					}
				}
				
				for (idx in self.actions) {
					var action = self.actions[idx];
					var icon = "";
					
					// actions to be returned have been restricted and current action is not explicitly allowed
					if (restrictActions._isRestricted && (!action.alias || !restrictActions[action.alias])) {
						continue;
					}

					if (action.icon) {
						icon = "<i class='fa fa-" + action.icon + "'></i> ";
					}

					r += "<a href='" + action.url + "'><button class='btn btn-default'>" + icon + action.title + "</button></a>";
				}
				
				return r;
			};
		};
		
		return new result(actions);
	}
};

sprat.ui.navigation.menu = {
	/**
	 * Default callback handler for processing a hierarchical menu path. The
	 * attribute "navigation-parent-item" of the selected list element (higher
	 * priority) or the parent element (lower priority) will be used to identify
	 * a parent jQuery selector.
	 * 
	 * @param {string} liSelector
	 *            jQuery selector to list element to enable.
	 * @param {string} listOfVisitedLeafs
	 *			   out-parameter. Stores the the visited selectors/menu item path
	 * @returns {string|null} selector of parent list item
	 */
	_defaultVisitor : function(liSelector, listOfVisitedLeafs) {
		var ul = $(liSelector).closest("ul");

		var liSelectorParentItem = $(liSelector).attr("navigation-parent-item") || $(ul).attr("navigation-parent-item");

		// remove all active elements of current hierarchy level
		$(ul).find("li").removeClass("active");

		// if list element has a button, set it to btn-primary
		$(liSelector).find("button").toggleClass("btn-primary").toggleClass("btn-default");

		// push current visited menu item to the post-processor array
		listOfVisitedLeafs.push($(liSelector));

		if (liSelectorParentItem) {
			return liSelectorParentItem;
		}

		return null;
	},
	/**
	 * Add an "active" class to every selector in the given array of jQuery elements
	 * @param {array} visitedLeaf Array of jQuery elements
	 */
	_defaultPostProcessor : function(visitedLeafs) {
		for (var i = visitedLeafs.length - 1; i >= 0; i--) {
			visitedLeafs[i].addClass("active");
		}
	},
	/**
	 * Enable given navigation path or menu structure by iterating over all
	 * parent elements.
	 * 
	 * @param {string} leaf
	 *            jQuery selector with menu item to enable
	 * @param {function} [_callbackVisitor]
	 *            if not provided, sprat.ui.navigation.menu._defaultVisistor is used
	 * @param {function} [_callbackPostProcessor]
	 *            if not provided, sprat.ui.navigation.menu._defaultPostProcessor is used
	 * @param {array} [_visitedLeafs]
	 *			  Array of visited leafs. First element is the leaf node, last element is the root node
	 */
	traverse : function(leaf, _callbackVisitor, _callbackPostProcessor, _visitedLeafs) {
		var visit = _callbackVisitor;
		var postProcess = _callbackPostProcessor;

		if (!visit) {
			// no _callbackVisitor function has been provided
			visit = sprat.ui.navigation.menu._defaultVisitor;
		}

		if (!postProcess) {
			// no _callbackPostProcessor has been provided
			postProcess = sprat.ui.navigation.menu._defaultPostProcessor;
		}

		if (!_visitedLeafs) {
			// initialize _visitedLeafs array
			_visitedLeafs = [];
		}

		// visit current node
		var parent = visit(leaf, _visitedLeafs);

		if (parent) {
			// the node has a valid parent, so traverse to upper node
			sprat.ui.navigation.menu.traverse(parent, visit, postProcess, _visitedLeafs);
		} else {
			// the last visited leaf has no root node so it *was* the root node itself. postProcess all visited leafs
			postProcess(_visitedLeafs);
		}
	}
};