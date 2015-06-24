/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};

/**
 * Utility methods to render different types of data
 */
sprat.ui.renderer = (function() {
	var self = this;

	/**
	 * Return the renderer for the provided column. If "th.rdt-property" is
	 * set, the property renderer will be used. If you have defined an
	 * th.rdt-renderer, the specified renderer will overwrite the property
	 * renderer.
	 * 
	 * If no renderer could be found, the default renderer is used. It just
	 * returns the vanilla text.
	 * 
	 * @param {string} rendererName Name of renderer
	 * @param {object} any
	 *            Any number or type of object which shall be passed to the
	 *            renderer. The arguments will be appended to directly called
	 *            method argument
	 * @return {function}
	 */
	self.get = function(rendererName /* any arguments */) {
		// if method is called with other arguments, store them
		// note: arguments is *not* an array
		var initializerArguments = arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : [];

		var dispatcher = function() {
			var fullDispatchedArguments = $.merge([], $.merge(Array.prototype.slice.call(arguments),
					initializerArguments));

			// fall back to default renderer if needed
			var renderer = self.renderers["default"];

			var r = "";

			// renderer can be found by name
			if (self.renderers[rendererName]) {
				renderer = self.renderers[rendererName];
			} else {
				var matched = Object.byString(self.renderers, rendererName);
				
				if (undefined !== matched) {
					renderer = matched;
				}
			}

			// build response
			if (!renderer) {
				throw "Renderer '" + rendererName + "' has not been registered. Use sprat.ui.renderer.register($name, $callback) to register a renderer.";
			}
			
			if (typeof (renderer) === 'function') {
				r += renderer.apply(undefined, fullDispatchedArguments);
			} else if (typeof (renderer) === 'object' && renderer.ui) {
				if (typeof (renderer.ui) !== "function") {
					throw "The renderer '" + rendererName + "' is of type object and has the property 'ui' but 'ui' is not a method";
				}
				r += renderer.ui.apply(undefined, fullDispatchedArguments);
			} else {
				throw "The renderer '" + rendererName + "' is neither a function nor an object containing a method named 'ui'";
			}

			return r;
		};

		return dispatcher;
	};

	self.render = function(rendererName) {
		var renderer = self.get(rendererName);
		return renderer.apply(args);
	};

	/**
	 * Register a new renderer. You are allowed to overwrite the default
	 * renderer "date", "datetime", "timeageo", "default", "boolean" and "list".
	 * 
	 * @param {string} name
	 * @param {object} renderer
	 *            must be a method with parameter signature (data (property
	 *            value), type (property type), full (row));
	 * @returns {___anonymous_renderer}
	 */
	self.register = function(name, renderer) {
		this.renderers[name] = renderer;
		return this;
	};

	/**
	 * Store the registered column renderers
	 */
	self.renderers = {};

	return self;
})();
