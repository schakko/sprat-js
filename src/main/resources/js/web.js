var sprat = sprat || {};
var $ = $ || {};

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
	hateoas: {
		/**
		 * Return the href of the requested relation
		 * @param object an _embedded object or resource
		 * @param name string name of relation
		 * @param parameters optional parameters
		 * @return string
		 * @throws if relation could not be found
		 */
		relation:  function(object, name, parameters) {
			var links = null, href = null, rel = null;

			if (!object || !(object.links || object._links)) {
				throw "Invalid HATEOAS object without .links";
			}

			links = object._links || object.links;

			for ( var idx in links) {
				// { $relation: $href, $relation2: $href2 }
				if (typeof (links[idx]) === 'string') {
					rel = idx;
					href = links[idx];
				} else {
					if (typeof (links[idx]) === 'object') {
						var current = links[idx];

						// [{ rel: $relation, href: $href }]
						if (current.rel) {
							rel = current.rel;
							href = current.href;
						}
						// [{ $rel: { href: $href } }]
						else if (current[name] && current[name].href) {
							rel = name;
							href = current[name].href;
						}
						// in case of
						// object: {'_links' :  { 'foo' : { 'href' : '/foo/bar' }}}
						else if (idx == name && current.href) {
							rel = idx;
							href = current.href;
						}
					}
				}

				if (rel == name) {
					break;
				}

				href = undefined;
			}

			if (!href) {
				throw "HATEOAS relation with name '" + name + "' does not exist";
			}
			
			return sprat.web.uri.parse(href, parameters);
		},
		embedded: function(data) {
			if (data._embedded) {
				var key = null;
				
				for (key in data._embedded) {
					return data._embedded[key];
				}
			}

			return [];
		}
	},
};

// export
$hateoas = sprat.web.hateoas;