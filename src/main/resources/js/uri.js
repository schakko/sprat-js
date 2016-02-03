/** global sprat namespace */
var sprat = sprat || {};

sprat.uri = sprat.uri || {};

/**
 * This package stores URI actions on an abstract level
 * 
 * @param _root
 *            Root URI for this action
 * @param _defaults
 *            a key/value object, where key is the alias and value is a string
 *            (a subaction of the _root), a callback function or an object.
 * @returns {sprat.uri.actionMapper}
 */
sprat.uri.actionMapper = function(_root, _defaults) {
	var self = this;

	// root URI, will be appended to the URI fo the collection or resource
	self.root = _root;

	/**
	 * Register a new alias for given endpoint
	 * 
	 * @param data
	 *            A string, a function or an object.
	 */
	self.register = function(name, data) {
		self.registered[name] = data;
	};

	// arguments pushed to the URI action
	self.arguments = [];

	// registered actions
	self.registered = {};

	/**
	 * Return the URI part, a callback function or a custom object
	 * 
	 * @param alias
	 *            alias of action; if undefined an empty sub action will be
	 *            returned
	 * @return object
	 * @throws if
	 *             alias is not registered
	 */
	self.data = function(alias) {
		if (!alias) {
			return "";
		}

		var obj = self.registered[alias];

		if (obj === undefined) {
			throw "There is no URI mapping for alias '" + alias + "'";
		}

		return obj;
	};

	/**
	 * If the data behind the given alias is a simple string, the string will be
	 * converted to a full/relative URI. If underlying data is an object, the
	 * property "uri" is used for creating the URI. If underlying data is a
	 * function, the function is called and their return value will returned to
	 * the caller of this function
	 * 
	 * @param alias
	 *            alias to lookup
	 * @return string full URI
	 */
	self.uri = function(alias) {
		obj = self.data(alias);

		// if an object has been provided, the user should define the property
		// "uri". Otherwise, no sub action will be appoended
		if ("object" === typeof (obj)) {
			/*jshint -W069 */
			if (!obj["uri"]) {
				obj = "";
			}
		}

		// arguments for the URI generation
		var args = $.merge([ self.root ], self.arguments);

		if ("function" === typeof (obj)) {
			// execute callback function with arguments and alias as last
			// parameter
			return obj.apply($.merge(args, [ alias ]));
		} else {
			if (obj.indexOf('/') === 0) {
				return obj;
			}

			var joined = $.grep(args, function(elem) {
				return elem !== null;
			}).join("/");
			
			return joined + "/" + obj;
		}
	};

	// register defaults
	for (var alias in _defaults) {
		self.register(alias, _defaults[alias]);
	}

	return self;
};

/**
 * Create a new resource model. By default, the actions collections.list and
 * resources.detail are registered.s
 * 
 * @param _baseUrl
 *            base URL of all actions of this resource model
 * @param _defaults
 *            objects default actions.
 * 
 * 
 * @returns {sprat.uri.resourceModel}
 */
sprat.uri.resourceModel = function(_baseUrl, _defaults) {
	var self = this;

	var root = _baseUrl;

	// default actions
	var defaults = {
		// collections actions returns multiple resources
		collections : {
			"list" : ""
		},
		// resources actions return a single resource
		resources : {
			"detail" : "",
		}
	};

	// deep copy; overwrite *this* defaults with user provided defaults
	$.extend(true, defaults, _defaults);

	// register new actionMapper
	self.collections = new sprat.uri.actionMapper(root, defaults.collections);
	self.resources = new sprat.uri.actionMapper(root, defaults.resources);

	/**
	 * Return the {@link sprat.uri.actionMapper} for collections
	 * 
	 * @return sprat.uri.actionMapper
	 */
	self.collection = function() {
		return self.collections;
	};

	/**
	 * Return the {@link sprat.uri.actionMapper} for a resource
	 * 
	 * @param data
	 *            an integer or a Spring Data resource
	 * @return sprat.uri.actionMapper
	 */
	self.resource = function(data) {
		var resolvedId = self.resourceIdResolver(data);

		if (undefined === resolvedId) {
			return;
		}

		self.resources.arguments = [ resolvedId ];
		return self.resources;
	};

	/**
	 * Resolve the ID by examing the provided data. If data is an integer, it
	 * will be returned. If data is an object with property ._links.self, the
	 * resource ID of this entry is returned
	 * 
	 * @return integer|null null is returned if the parent resource itself
	 *         should be returned
	 * @throw if provided data does not contain an ID
	 */
	self.resourceIdResolver = function(data) {
		if (data === undefined || data === 0) {
			return null;
		}

		if (data % 1 === 0) {
			return data;
		}

		/*jshint -W069 */
		if (data && data["_links"] && data._links["self"]) {
			var s = data._links.self.href;
			// Spring Data REST: exclude templated string like 123{?projection}
			var id = s.substring(s.lastIndexOf("/") + 1);
			
			if (id.indexOf("{") > 0) {
				return id.substring(0, id.indexOf("{"));
			}

			return id;
		}

		throw "The provided resource resource is not an integer value nor does it contain the path _links.self with the root of the resource. Override .resource.rest.root";
	};
};

// register default actions for views
sprat.uri.resourceModel.defaults = function(_baseUrl, _defaults) {
	var defaults = {
		resources : {
			detail : {
				title : "Details",
				icon : "share"
			},
			edit : {
				title : "Bearbeiten",
				icon : "pencil"
			}
		}
	};

	return new sprat.uri.resourceModel(_baseUrl, $.extend(true, {}, defaults,
			_defaults));
};

/**
 * Return the value of the GET-parameter
 * @param parameter string name of GET parameter
 * @param search string|null if null, the window.location.search attribute is used. Otherwise the search string must begin with '?'
 * @return string|object
 */
sprat.uri.requestParameter = function(parameter, search) {
	var a = (search || window.location.search).substr(1).split('&');

	if (a === "")
		return {};
	var b = {};
	
	for (var i = 0; i < a.length; ++i) {
		var p = a[i].split('=');
		if (p.length != 2)
			continue;
		b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
	}

	if (b && b[parameter]) {
		return b[parameter];
	}

	return b;
};