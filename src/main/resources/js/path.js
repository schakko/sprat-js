var sprat = sprat || {};
var $ = $ || {};

/**
 * sprat.path is a simple utility to resolve template paths for REST collections
 * and resources. Use <code>
 * var user_resource = new
 * sprat.path()
 * 	.resourceAt('/user/{0}')
 * 		.add('index')
 * 		.add('details', '/detail')
 * 		.finish()
 * 	.collectionAt('/users')
 * 		.add('index')
 * 		.finish()
 * </code>
 * to create a new path resource for user objects. You can access the details
 * path for the user id '555' by calling <code>
 * user_resource.resource(555).details(); // returns '/user/555/detail'
 * </code>
 * 
 * sprat.path.test.js contains QUnit tests with more examples.
 */
sprat.path = function() {
	var self = {};

	/**
	 * Mapping functions. The mapping functions contains an object per function
	 * alias
	 */
	var mappings = {
		resource : {},
		collection : {}
	};

	/**
	 * Accessors are only used to map the function calls to the mappings array
	 */
	var accessors = {
		resource : null,
		collection : null
	};

	var util = {
		/**
		 * Creates a fluent interface for adding new URI mappings to the context
		 * 
		 * @param object
		 *            object/hashmap containing the mapping between an alias and
		 *            the URI mapper object
		 * @param object
		 *            object/hashmap containing the alias as a function so you
		 *            can call the alias 'my_alias' as my_alias().
		 * @return fluent interface
		 */
		createFluentInterface : function(mapping, aliasFunctions) {
			var _self = {};
			_self.mapping = mapping;
			_self.aliasFunctions = aliasFunctions;

			/**
			 * Add a new alias to the aliased functions object and register the
			 * function handler
			 * 
			 * @param string
			 *            alias of the path
			 * @param string|function
			 *            if parameter is a string, it will be appended to the
			 *            root string. If it is a function, the function is used
			 *            to return the full resource path.
			 */
			_self.add = function(alias) {
				if (arguments.length === 0) {
					throw "Expected at least an alias when adding a resource or a collection";
				}

				alias = arguments[0];
				var append = '';
				var _templatePathTranslator = null;

				// second parameter: string|function
				if (arguments.length > 1) {
					if (typeof (arguments[1]) === 'string') {
						append = arguments[1];
					} else if (typeof (arguments[1]) === 'function') {
						_templatePathTranslator = arguments[1];
					}
				}
				
				if (append && /^\w/.test(append)) {
					append = "/" + append;
				}

				// if user has not provided own function to translate the
				// template path, we use the default handler
				_templatePathTranslator = _templatePathTranslator || function(state) {
					return sprat.web.uri.parse(state.root + append, state.lastArguments);
				};

				if (_self.aliasFunctions[alias]) {
					throw "Alias '" + alias + "' is already defined";
				}

				_self.mapping[alias] = {
					uri : _templatePathTranslator,
					renderer : function() {
						throw "Renderer not defined";
					},
					context : {}
				};

				// register the forwarded alias function. By adding an alias
				// 'my_alias' the method my_alias() is registered and callable
				_self.aliasFunctions[alias] = function() {
					// push arguments from my_alias(..args..) to the last
					// argument handler
					util.pushArguments(this.__internal.lastArguments, arguments);
					// call the mapping function to create the internal URI
					return _self.mapping[alias].uri(this.__internal);
				};

				return _self;
			};

			/**
			 * Fluent interface sugar. Return the original object
			 * 
			 * @return object sprat.path
			 */
			_self.finish = function() {
				return self;
			};

			return _self;
		},
		/**
		 * Create a new proxy function for .resource(... args...) or
		 * .collection(). With every call the arguments of .resource() and
		 * .collection() are passed to the alias function. Returns the alias
		 * function.
		 * 
		 * @param object
		 *            aliasFunction holds all aliases added later with .add(...)
		 * @return object
		 */
		initializeAccessor : function(aliasFunctions) {
			var _self = {};
			_self.aliasFunctions = aliasFunctions;

			return function() {
				// this is a little bit tricky. As this is a inner function we
				// can not use "arguments" to access the function parameter.
				// Instead, we have to use *this* to access its arguments.
				//
				// The last arguments are resetted to the current arguments
				_self.aliasFunctions.__internal.lastArguments = this;
				// return all aliases as callable function
				return _self.aliasFunctions;
			};
		},
		/**
		 * Create a default object structure for storing the function aliases
		 * 
		 * @param string
		 *            root
		 */
		createAliasFunctionHolder : function(root) {
			var aliasFunctions = {
				/**
				 * Internal data
				 */
				__internal : {
					'root' : root,
					/**
					 * Contains the arguments from .resource()/.collections and
					 * $alias(...arguments...)
					 */
					lastArguments : []
				}
			};

			return aliasFunctions;
		},
		/**
		 * Pushes every argument element to the array
		 * 
		 * @param array
		 *            an initialized array
		 * @param arguments
		 *            function arguments
		 * @return the array containing the pushed values
		 */
		pushArguments : function(array, args) {
			for (var i = 0; i < args.length; i++) {
				// use special resolver
				var value = self.resolvers.resolve(args[i]);
				array.push(value);
			}

			return array;
		}
	};

	/**
	 * Registered mappings
	 */
	self._mapppings = function() {
		return mappings;
	};

	/**
	 * Resolvers used for identifying variables inside the path template
	 */
	self.resolvers = {
		registered : [
		/**
		 * Resolver for Spring Data / HATEOS objects
		 */
		function(data) {
			/*jshint -W069 */
			if (data && data["_links"] && data._links["self"]) {
				var s = data._links.self.href;
				// Spring Data REST: exclude templated string like
				// 123{?projection}
				var id = s.substring(s.lastIndexOf("/") + 1);
				if (id.indexOf("{") > 0) {
					return id.substring(0, id.indexOf("{"));
				}

				return id;
			}

			return undefined;
		},
		/**
		 * Fallback to return the data
		 */
		function(data) {
			return data;
		} ],
		/**
		 * Resolve the data
		 */
		resolve : function(data) {
			for (var i = 0; i < this.registered.length; i++) {
				var r = this.registered[i](data);

				if (r !== undefined) {
					return r;
				}
			}

			return data;
		}
	};

	/**
	 * Provide paths for a single resource. Pass one or multiple parameters to
	 * satisfy your path variable structure.
	 * 
	 * @return
	 */
	self.resource = function() {
		// sanity check
		if (!accessors.resource) {
			throw "No resource path has been prior defined by using resourceAt(...)";
		}
		
		// call the proxy and apply all arguments from the .resource(...args..)
		return accessors.resource.apply(util.pushArguments([], arguments));
	};

	/**
	 * Create a new resource at the provided root path. Use
	 * resourceAt('/root').add('...') to add a new alias function to access the
	 * REST function.
	 * 
	 * @param string
	 *            root
	 * @return
	 */
	self.resourceAt = function(root) {
		// initialize state of forwarded function aliases
		var aliasFunctions = util.createAliasFunctionHolder(root);
		accessors.resource = new util.initializeAccessor(aliasFunctions);
		return new util.createFluentInterface(mappings.resource, aliasFunctions);
	};

	/**
	 * Provide paths for a collection of resources. Pass one or multiple
	 * parameters to satisfy your path variable structure.
	 * 
	 * @return
	 */
	self.collection = function() {
		// sanity check
		if (!accessors.collection) {
			throw "No collection path has been prior defined by using collectionAt(...)";
		}

		// call the proxy and apply all arguments from the .collection(...args..)
		return accessors.collection.apply(util.pushArguments([], arguments));
	};

	/**
	 * Create a new collection at the provided root path. Use
	 * collectionAt('/root').add('...') to add a new alias function to access
	 * the REST function.
	 * 
	 * @param string
	 *            root
	 * @return
	 */
	self.collectionAt = function(root) {
		var aliasFunctions = util.createAliasFunctionHolder(root);
		accessors.collection = new util.initializeAccessor(aliasFunctions);
		return new util.createFluentInterface(mappings.collection, aliasFunctions);
	};

	return self;
};