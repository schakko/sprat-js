var sprat = sprat || {};

sprat.web = {
	uri: {
		/**
		 * Parse a path template and resolve every path variable by given
		 * parameters. Indexed template variables ({0}, {1}, {...}) are looked up by
		 * the passed parameter count. Template variables by name like '{name}' are
		 * resolved by iterating over every parameter and tryining to find the given
		 * key if the parameter is an object. If a default value is given
		 * ({name:my_default_value}) the default value is used if the path variable
		 * could not be resolved.
		 * 
		 * @param {string} path
		 *            The path can have a format like '/a/b/c={0}/d={1}',
		 *            '/a?{name:default_value}' or '/a?name={name}'. The template
		 *            variables can be mixed up.
		 * @param {array} parameters
		 *            a list of objects, strings or integers which are
		 *            used to populate the path variables.
		 */
		parse: function(path, parameters) {
			var matcher = /\{([\?|\&]?)(\w*)(:(\w*))?\}/;

			/**
			 * Extract the value for the given identifier from the provided
			 * parameters
			 * 
			 * @param {string} identifier
			 * @param {{number|string}} _defaultValue 
			 *			value to fallback if path variable could not be found
			 * @param {array} parameters
			 * @return _defaultValue or an empty string if parameter is not present
			 */
			function valueFor(prefix, identifier, _defaultValue, parameters) {
				parameters = parameters || {};
				
				// identifier is an integer
				if ($.isNumeric(identifier)) {
					if (parseInt(identifier) < parameters.length) {
						return prefix + parameters[parseInt(identifier)];
					}
				}

				// find objects in parameter list and find the given key
				for (var i = 0; i < parameters.length; i++) {
					if (typeof (parameters[i]) === 'object') {
						if (parameters[i][identifier]) {
							return prefix + parameters[i][identifier];
						}
					}
					else {
						if (parameters[i] == identifier) {
							return prefix + identifier;
						}
					}
				}
				
				// parameters is an array
				for (var key in parameters) {
					if (key == identifier) {
						return prefix + parameters[key];
					}
				}

				return _defaultValue || "";
			}

			var matches;

			// iterate over every match to make sure we can handle '/{0}/{1}/...'
			while (null !== (matches = matcher.exec(path))) {
				var replace = matches[0];
				path = path.replace(replace, valueFor(matches[1] /* prefix */, matches[2] /* parameter name */, matches[4] /* default value */, parameters));
			}

			return path;
		}
	},
	json: {
		hal: {
			/**
			 * Resolve the given relation from the container object and replace any parameter if the .href element is templated.
			 * It supports '_links[ { rel: $relation, href: "..." }, { rel: $relation2, href: "...") }]' and '_links.$relation.href' style
			 * @param {string} name of HAL relation
			 * @param {object} HAL container
			 * @param {object} any path template parameters. These parameters are passed to sprat.web.uri.parse
			 * @return string or undefined if relation does not exist
			 */
			resolveRelation: function(relation, container, parameters) {
				if (container._links) {
					container = container._links;
				}
				
				var href = null;
				
				// _links.$relation.href
				if (container[relation] && container[relation].href) {
					href = container[relation].href;
				}
				
				// _links[ { rel: $relation, href: "..." }, { rel: $relation2, href: "...") }]
				if (Array.isArray(container)) {
					for (var i = 0, m = container.length; i < m; i++) {
						if ((container[i].rel == relation) && container[i].href) {
							href = container[i].href;
						}
					}
				}
				
				if (!href) {
					return undefined;
				}
				
				return sprat.web.uri.parse(href, parameters);
			}
		}
	}
};