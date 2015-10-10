/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.component = sprat.ui.component || {};

/**
 * Enable custom scopes for sprat.ui.component.dataTable
 * @param {object} dataTable sprat.ui.component.dataTable
 * @param {object} _config optional config
 */
sprat.ui.component.scoping = function(dataTable, _config) {
	var ComponentScoping = function(dataTable, _config) {
		var self = this;
		
		// expect sprat.ui.component.dataTable. It is not possible to determine the correct type, b/c it is anonymous.
		if (!dataTable || !dataTable.config) {
			throw "sprat.ui.component.scoping requires sprat.ui.component.dataTable instance as first argument";
		}
	
		var defaults = {
			/**
			 * GET parameter which is used for activating a specific scope on load
			 */
			requestdScopeHttpGetParam: "scope",
			endpoint: {
				/**
				 * REST endpoint to user
				 */
				url: undefined,
				/**
				 * Builder to create a endpoint URL for a given scope.
				 * @param {string} scope if not empty, the ?scope= parameter is appended to the .endpoint.url parameter
				 * @param {object} config configuration
				 * @return string
				 */
				builder: function (scope, config) {
					if (scope) {
						return config.endpoint.url + "?scope=" + scope;
					}
					
					return config.endpoint.url;
				}
			},
			widget: {
				/**
				 * jQuery selector to identify scoping widgets
				 */
				selector: "button.sprat-query",
				/**
				 * enable a widget
				 * @param {object} $item jQuery item
				 */
				enable: function ($item) {
					$item.removeClass("btn-default");
					$item.addClass("btn-primary");
				},
				/**
				 * disable a widget
				 * @param {object} $item jQuery item
				 */
				disable: function ($item) {
					$item.removeClass("btn-primary");
					$item.addClass("btn-default");
				}
			}
		};
		
		self.dataTable = dataTable;
		// merge user-defined configuration with default configuration
		self.config = $.extend(true, {}, defaults, _config);
		
		// if the endpoint has not been defined, it is taken from the dataTable object
		if (!self.config.endpoint.url) {
			self.config.endpoint.url = dataTable.config().restEndpoint;
		}
		
		var util = {
			/**
			 * return GET parameter from requested URL
			 * @param {string} name name of GET parameter
			 * @return string|null
			 */
			getParam: function (name) {
				var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);
				
				if (results === null) {
					return null;	
				}
				
				return decodeURIComponent(results[1]) || null;
			}
		};
		
		/**
		 * Get the scope which the user has been requested by appending ?scope=XYZ to the URL
		 * @return string|undefined
		 */
		self.requestedScope = function () {
			var scope = util.getParam(self.config.requestdScopeHttpGetParam);
			
			if ($("button[sprat-query-scope='" + scope + "']").length > 0) {
				return scope;
			}

            return undefined;
		};
		
		/**
		 * Find the widget for given scope
		 * @param {string} scope name of scope to be activated. Can be explicitly null or undefined to identify the default scope
		 * @return jQuery item or null
		 */
		self.findScopeWidget = function (scope) {
			var items = $(self.config.widget.selector);
			var item = null, queryScope = null;
				
			for (var i = 0, m = items.length; i < m; i++) {
				item = items[i];
				queryScope = $(item).attr('sprat-query-scope');
				
				// default scope 
				if (!scope && !queryScope) {
					return item;
				}
				
				if (scope == queryScope) {
					return item;
				}
			}
			
			return null;
		};
		
		/**
		 * Enable the scope with the given name. If the scope is available, the widget scope gets activated. All other scopes gets deactivated. The REST endpoint of the connected dataTable is updated and a reload is triggered.
		 * @param {string} scope name of scope to activate, can be empty or undefined to identify the default scope. If the scope does not exist, an exception is thrown.
		 * The event "scope-activated[name_of_scope]" is triggered.
		 */
		self.enableScope = function (scope) {
			var widget = self.findScopeWidget(scope);
			
			if (!widget) {
				throw "Trying to activate non-existing scope '" + scope + "'";
			}
			
			self.currentScope = scope;

			$(self.config.widget.selector).each(function () {
				if ($(this).is($(widget))) {
					self.config.widget.enable($(this));
				}
				else {
					self.config.widget.disable($(this));
				}
			});

			// populate event to make interactions possible
			$(this).trigger("scope-activated", [ self.currentScope ]);
			
			// update the endpoint of the underlying data
			self.dataTable.updateEndpoint(self.config.endpoint.builder(self.currentScope, self.config));
		};
		
		// bind widgets
		$(self.config.widget.selector).click(function() {
			self.enableScope($(this).attr('sprat-query-scope'));
		});
		
		self.enableScope(self.requestedScope());
	};
	
	return new ComponentScoping(dataTable, _config);
};