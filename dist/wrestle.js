var sprat = sprat || {};

/**
 * Wrestle introspects the HTTP response after an AJAX call and executes
 * different handlers based upon the result. This makes it easy to handle
 * different response types and backends.
 */
sprat.wrestle = (function() {
	var self = {};

	self.hateoas = {
		/**
		 * Check if the resource contains the _links.self.href location
		 * 
		 * @param {object}
		 *            data
		 * @return {boolean}
		 */
		isSelfHrefAvailable : function(data) {
			return this.isValidResourceLink('self', data);
		},
		/**
		 * Check if the _links.$resourceName.href key is available
		 * 
		 * @param {string} resourceName
		 *            name of resource
		 * @param {object} data
		 *            data
		 * @return {boolean}
		 */
		isValidResourceLink : function(resourceName, data) {
			return (data && data._links && data._links[resourceName] && data._links[resourceName].href);
		},
		/**
		 * Get the link for the given resource
		 * 
		 * @param {string} resourceName
		 *            name of resource
		 * @param {object} data
		 * @throws Will throw exception if resource link is not available
		 * @return {string} resource link
		 */
		resourceLink : function(resourceName, data) {
			if (!this.isValidResourceLink(resourceName, data)) {
				throw "Resource link '" + resourceName + "' does not exist";
			}

			return data._links[resourceName].href;
		}
	};

	var util = {
		/**
		 * Is the given object an jqXHR response or not
		 * 
		 * @param {object} object
		 * @returns {boolean}
		 */
		isJqXHR : function(object) {
			return (object && object.status && object.readyState && (object.responseText !== undefined));
		},
		/**
		 * Execute every handler method of the pipe array
		 * 
		 * @param {array} pipe
		 *            array of handlers
		 * @param {object}
		 *            data
		 * @param {object}
		 *            jqXHR
		 * @param {string}
		 *            textStatus
		 * @param {object}
		 *            context
		 */
		runPipes : function(pipe, data, jqXHR, textStatus, context) {
			for (var i = 0, m = pipe.length; i < m; i++) {
				var handler = pipe[i];

				if (typeof (handler) !== 'function') {
					util.error("Expected a function but got the following element:");
					util.debug(handler);
					throw "Expected a function as pipe handler, current element at index '" + i + "' is " + handler;
				}

				var r = handler(data, jqXHR, textStatus, context);

				if (r === true) {
					util.debug("Pipe returned true, no further pipe handling");
					return;
				}
			}
		},
		/**
		 * Debug message
		 * 
		 * @param {string} msg
		 */
		debug : function(msg) {
			// by default debugging is disabled
			if (console && sprat.$spratAppInstance && sprat.$spratAppInstance.debug()) {
				console.debug(msg);
			}
		},
		/**
		 * Error message
		 * 
		 * @param {string} msg
		 */
		error : function(msg) {
			if (console) {
				console.error(msg);
			}
		},
		/**
		 * Info message
		 * 
		 * @param {string} msg
		 */
		info : function(msg) {
			if (console) {
				console.info(msg);
			}
		},
		/**
		 * Return an array, based upon the given parameter
		 * 
		 * @param {{Array|null|string}} param
		 *            parameter
		 * @return {Array} An empty array if "param" is null; an one-sized array with one element if "param" is a string or the "param" if "param" is an array
		 */
		assertArray : function(param) {
			if (param === null || param === undefined) {
				return [];
			}

			if (!$.isArray(param)) {
				return [ param ];
			}

			return param;
		}
	};

	/**
	 * Global available pipes. To add a new pipe to this array, just use
	 * sprat.wrestle.pipes.always['my_pipe'] = function() { return function() {} };
	 * Please note that your will only register factory methods which return new
	 * handlers.
	 * 
	 * If a pipe entry matches a given response, it should trigger an event to
	 * let the user decide how to handle the response.
	 */
	self.pipes = {
		/**
		 * self.pipes.always are executed directly after receiving the HTTP
		 * response. The handlers are for deciding if the response is an
		 * (unrecoverable) error or a normal response.
		 */
		always : {
			/**
			 * Thanks to jQuery > 1.9 we have to process the server response for
			 * delegating to the right handler. jQuery > 1.9 assumes that an
			 * empty response body with an OK HTTP status code is invalid and
			 * calls the "error" handler.
			 * 
			 * @return {function} new function(dataOrJqXHR, textStatus, jqXHROrErrorThrown,
			 *         context)
			 */
			successForHttpHeaderBetween200And399 : function() {
				return function(dataOrJqXHR, textStatus, jqXHROrErrorThrown, context) {
					util.debug("Running successForHttpHeaderBetween200And399 ... ");
					// argument order on fail(): jqXHR, textStatus, errorThrown
					// argument order on done(): data, textStatus, jqXHR
					var jqXHR = util.isJqXHR(dataOrJqXHR) ? dataOrJqXHR : jqXHROrErrorThrown;

					// some valid responses which can return JSON or empty
					// responses
					if (jqXHR.status >= 200 && jqXHR.status < 400) {
						util.debug("Received HTTP status code >= 200 && < 400, executing success pipe");

						var data = dataOrJqXHR;

						// if textStatus has "parseerror", it would mean that
						// the
						// response
						// has been flagged as error an we must extract the data
						// from the
						// error argument
						if (textStatus == "parseerror") {
							data = jQuery.parseJSON(jqXHR.responseText);
						}

						util.runPipes(context.pipes.success, data, jqXHR, textStatus, context);
						return true;
					}

					util.debug("Status code '" + jqXHR.status + "' is *not* handled by pipes.success");

					// can not handle status >= 400 or < 200
					return false;
				};
			},
			/**
			 * Check if the response is an errors and should be executed at
			 * last in your always-pipe
			 * @return {function}
			 */
			fallbackToFail : function() {
				return function(dataOrJqXHR, textStatus, jqXHROrErrorThrown, context) {
					util.debug("Running fallbackToFail ... ");

					// argument order on fail(): jqXHR, textStatus, errorThrown
					// argument order on done(): data, textStatus, jqXHR
					var jqXHR = util.isJqXHR(dataOrJqXHR) ? dataOrJqXHR : jqXHROrErrorThrown;
					var data = {};

					if (jqXHR.responseText) {
						try {
							data = jQuery.parseJSON(jqXHR.responseText);
						} catch (ex) {
							util.debug("Failed to parse responseText as JSON, content '" + jqXHR.responseText + "'");
						}
					}

					util.debug("Running " + context.pipes.fail.length + " error handlers");

					util.runPipes(context.pipes.fail, data, jqXHR, textStatus, context);
				};
			},
		},
		/**
		 * Responses which are valid for the application
		 */
		success : {
			/**
			 * Assume that the HTTP header "Location" or
			 * "X-Sprat-Next-Location" is set and uses this header to do a
			 * client side redirect. This is required to prevent a) duplicate
			 * POST submits and b) messing around with Chromes handling of HTTP
			 * 302 redirects.
			 * This success handler is very specific for some internal applications and should be removed sometimes.
			 * 
			 * @return {function}
			 */
			handleRedirect : function() {
				return function(data, jqXHR) {
					util.debug("Running handleRedirect ...");
					var location = jqXHR.getResponseHeader('Location') || jqXHR.getResponseHeader('X-Sprat-Next-Location');

					if (location) {
						window.location.replace(location);
						return true;
					}
				};
			},
			/**
			 * Assume that the server responded with 204 - No Content. The
			 * event 'handleModelUpdated' is triggered.
			 * @return {function}
			 */
			handleModelUpdated : function() {
				return function(data, jqXHR, textStatus, context) {
					util.debug("Running handleModelUpdated");

					if (jqXHR.status == '204') {
						util.debug("Received HTTP 204 response, triggering handleModelUpdated event");
						$(document).trigger('handleModelUpdated', [ data, jqXHR, context ]);

						return true;
					}
				};
			},
			/**
			 * Assert that the server responds with a specific HTTP response
			 * code. Normally, this would be an HTTP 200 message.
			 * @return {function}
			 */
			expectResponseCode : function() {
				return function(data, jqXHR, textStatus, context) {
					util.debug("Running expectResponseCode");

					if (!context.expectResponseCode) {
						util.debug("no .expectResponseCode given in .context, returning");
						return false;
					}

					if (jqXHR.status == context.expectResponseCode) {
						util.debug("Received expected HTTP response code '" + context.expectResponseCode + "', triggering expectResponseCode event");
						$(document).trigger('expectResponseCode', [ data, jqXHR, context ]);

						return true;
					}
				};
			},
			/**
			 * Default handler
			 * @return {function}
			 */
			handleUserNextAction : function() {
				return function() {
				};
			}
		},
		/**
		 * Server-side failures. This could be unrecoverable application errors,
		 * validation errors or other defined errors.
		 */
		fail : {
			/**
			 * Return a new exception handler which is executed for server-side
			 * Java/Spring exceptions. The jQuery event
			 * 'springApplicationExceptionHandler' is triggered if an exception
			 * occurs. The event has the exception object as first event
			 * argument, all parameters of *this* method are passed as further
			 * parameters, 'context' is the first. All other queued pipe entries
			 * are discarded.
			 * 
			 * @return {function(data, jqXHR, textStatus, errorThrown, context)}
			 */
			springApplicationExceptionHandler : function() {
				return function(data, jqXHR, textStatus, errorThrown, context) {
					// Spring REST. Ignore exceptions of type BindException as
					// these are
					// validation exceptions
					var hasException = data.cause || (data.exception && (data.exception != 'org.springframework.validation.BindException'));

					if (hasException) {
						util.debug("Triggering springApplicationExceptionHandler");
						var exception = ('object' === typeof (data)) ? data : jQuery.parseJSON(data.responseText);

						$(document).trigger('springApplicationExceptionHandler',
								[ exception, context, data, jqXHR, textStatus, errorThrown ]);

						// stop further handlers from execution
						return true;
					}
				};
			},
			/**
			 * Return a new exception handler for Spring Data REST endpoints.
			 * The event 'springRESTErrors' is triggered if an error ocurrs. The
			 * event has the error object as first event argument, all
			 * parameters of *this* method are passed as further parameters,
			 * 'context' is the first.
			 * 
			 * @return {function(data, jqXHR, textStatus, context)}
			 */
			springRESTErrors : function() {
				return function(data, jqXHR, textStatus, context) {
					var parsedData = {};
					
					try {
						parsedData = jQuery.parseJSON(jqXHR.responseText);
					} catch (ex) {
					}

					var errors = null;

					// Spring REST single error response
					if (parsedData.error) {
						util.debug("Triggering springRESTErrors ... ");

						errors = [ parsedData ];

						$(document).trigger('springRESTErrors', [ errors, context, data, jqXHR, textStatus ]);

						return true;
					}
				};
			},
			/**
			 * Parse validation errors from
			 * org.springframework.Validation. The event
			 * 'springValidationErrors' is triggered if an error ocurrs. The
			 * event has the error object as first event argument, all
			 * parameters of *this* method are passed as further parameters.
			 * 
			 * @return {function(data, jqXHR, textStatus, errorThrown, context)}
			 */
			springValidationErrors : function() {
				return function(data, jqXHR, textStatus, context) {
					var parsedData = {};

					try {
						parsedData = jQuery.parseJSON(jqXHR.responseText);
					} catch (ex) {
					}

					var errors = null;

					if (parsedData.errors && $.isArray(parsedData.errors)) {
						util.debug("Triggering springValidationErrors ... ");
						errors = parsedData.errors;

						$(document).trigger('springValidationErrors', [ errors, context, data, jqXHR, textStatus ]);

						return true;
					}
				};
			},
			/**
			 * Should be the last handler in your pipe. Something went horrible
			 * wrong.
			 * @return {function}
			 */
			unknownResponse : function() {
				return function(data, jqXHR, textStatus, context) {
					var error = "Received unrecognized response from the backend, please contact developers";

					if (console) {
						util.debug("Data of unrecognized response: ");
						util.debug(data);
						util.debug(context);
					}

					throw error;
				};
			}
		}
	};

	/**
	 * Global configuration for sprat.wrestle
	 */
	self.configuration = {
		/**
		 * These handlers are executed first after receiving the HTTP response.
		 * If you want to overwrite this method, you must return an error with
		 * newly constructed pipe entries.
		 * 
		 * @return {Array} array with handlers
		 */
		firstResponseHandlers : function() {
			return [ new self.pipes.always.successForHttpHeaderBetween200And399(),
					new self.pipes.always.fallbackToFail() ];
		},
		/**
		 * Profiles can be used for defining standard functionality for
		 * different backend APIs.
		 */
		profiles : {
			/**
			 * Add a new profile to the global configuration element
			 * 
			 * @param {string} profile name
			 * @param {object} config
			 */
			add : function(name, config) {
				// inherit default configuration
				config = $.extend(true, {
					success : [],
					fail : []
				}, config);

				self.configuration.profiles[name] = config;
			}
		},
		// custom configuration for handlers
		handlers : {

		},
		/**
		 * Default pipe entries which are executed on every response if the user
		 * has not overwritten the response handling.
		 */
		defaults : {
			success : function() {
				return [ 
							new self.pipes.success.handleRedirect(), 
							new self.pipes.success.handleModelUpdated(),
							new self.pipes.success.expectResponseCode(), 
							new self.pipes.success.handleUserNextAction() 
						];
			},
			fail : function() {
				return [ 
							new self.pipes.fail.springApplicationExceptionHandler(),
							new self.pipes.fail.springRESTErrors(), 
							new self.pipes.fail.springValidationErrors() 
						];
			}
		},
	};

	/**
	 * Based upon the provided _arguments the AJAX call for the backend is
	 * prepared. You have different possibilites to make a new API call. Please
	 * look into the unit test definitions for more information.
	 * 
	 * @param {array} _arguments
	 *            arguments for the rest call
	 * @param {string}
	 *            HTTP method
	 * @return {object} $.ajax
	 */
	self._delegateSimpleRequest = function(_arguments, method) {
		var context = {
			pipes : {
				success : undefined,
				fail : undefined
			},
			handlers : self.configuration.handlers,
			ajax : {}
		};

		var data = null;
		var providedSuccessCallbacks = null;
		var providedFailCallbacks = null;

		var idxBeginCallbacks = 1;
		var idxEndCallbacks = 3;

		if (typeof (_arguments) == 'string') {
			throw "_arguments must be an array";
		}

		if (_arguments.length === 0 || _arguments > 4) {
			throw "_toCallArguments must have [url], [url, cbSuccess()], [url, data, cbSuccess()], [url, data, options] or [url, data, cbSuccess(), options] as first argument. You gave: " + JSON.stringify(_arguments);
		}

		// addtional context options are passed as last argument
		if (_arguments.length > 2) {
			var lastArgument = _arguments[_arguments.length - 1];

			if (typeof (lastArgument) === 'object' && !jQuery.isArray(lastArgument)) {
				context = $.extend(true, context, lastArgument);

				// last callback must be before the context object
				idxEndCallbacks = _arguments.length - 2;
			}
		}

		// data is passed as second argument
		if (_arguments.length >= 2) {
			if (typeof (_arguments[1]) === 'object') {
				data = _arguments[1];

				// first callback begins at position 2 after the data argument
				idxBeginCallbacks = 2;
			}
		}

		// determine position of any callbacks
		if (idxBeginCallbacks <= _arguments.length - 1) {
			// only success callbacks has been provided
			if (idxBeginCallbacks <= idxEndCallbacks) {
				providedSuccessCallbacks = _arguments[idxBeginCallbacks];
			}

			// Addtionally, the next argument has been the end callback
			if (idxBeginCallbacks + 1 == idxEndCallbacks) {
				providedFailCallbacks = _arguments[idxEndCallbacks];
			}
		}

		// if callbacks has been provided -an empty provided callback array *is*
		// counted as provided - overwrite the defaults
		context = self.updatePipes(providedSuccessCallbacks, providedFailCallbacks, context);

		return self.call(_arguments[0], data, method, context);
	};

	/**
	 * Ensure that the given parameters are passed into the context variable.
	 * <ul>
	 * <li>User-defined callbacks have precedence</li>
	 * <li>If a profile is provided but no callback, the profile is chosen
	 * before the defaults</li>
	 * <li>If no user-defined callback or profile is provided, the default
	 * configuration is used</li>
	 * </ul>
	 * 
	 * @param {{function|array|null}}
	 *            success callbacks provided as an argument
	 * @param {{function|array|null}}
	 *            failure callback provided as an argument
	 * @param {object}
	 *            context
	 * @return {object} context
	 */
	self.updatePipes = function(success, fail, context) {
		// defaults
		context = $.extend(true, {
			pipes : {
				success : undefined,
				fail : undefined
			},
			handlers : {

			}
		}, context);

		// enable profile
		if (context.profile) {
			util.debug("Profile '" + context.profile + "' activated");

			if (!self.configuration.profiles[context.profile]) {
				throw "Requested profile '" + context.profile + "' does not exist";
			}

			context.pipes = self.configuration.profiles[context.profile];
		}

		// provided success and fail arguments superseed the profile
		// configuration
		if (success) {
			context.pipes = context.pipes || {};
			context.pipes.success = util.assertArray(success);

			if (fail) {
				context.pipes.fail = util.assertArray(fail);
			}
		}

		// if no success/fail pipes have been defined, register our own
		if (context.pipes.success === undefined) {
			context.pipes.success = self.configuration.defaults.success();
		}

		if (context.pipes.fail === undefined) {
			context.pipes.fail = self.configuration.defaults.fail();
		}

		return context;
	};

	/**
	 * Execute the given AJAX call by delegating to jQuery.ajax(). Every request
	 * is made by using application/json as Content-Type.
	 * 
	 * @param {string} _url
	 *            URL
	 * @param {object|null} _data
	 *            unserialized data, the method determines if a serialization is
	 *            required or not
	 * @param {string} _method
	 *            HTTP method
	 * @param {object} _context
	 *            context, you can overwrite $.ajax() parameter in the property
	 *            context.ajax
	 */
	self.call = function(_url, _data, _method, _context) {
		// clear current context or we will run in problems with the current
		// AJAX call state
		var self_call = {};

		if (!_method) {
			throw "HTTP method not provided";
		}

		var contextDefault = {
			method : _method,
			firstResponseHandlers : self.configuration.firstResponseHandlers(),
			ajax : {
				url : _url,
				type : _method,
				dataType : "text json",
				contentType : "application/json"
			}
		};

		// inherit defaults
		self_call.context = $.extend(true, contextDefault, _context);

		if (_data) {
			// data has not been provided by user and we don't have a GET
			// request
			if (!self_call.context.ajax.data) {
				// Data for GET must be passed by adding the values to the
				// query string
				if (_method == 'GET') {
					self_call.context.ajax.data = _data;
				} else {
					// POST, HEAD and so on must be JSONized
					self_call.context.ajax.data = JSON.stringify(_data);
				}
			}
		}

		// this procedure is required to handle the different response types.
		// @see sprat.rest.handler.always for more information.
		return $.ajax(self_call.context.ajax).always(function(a, b, c) {
			self.run(self_call.context.firstResponseHandlers, a, b, c, self_call.context);
		});
	};

	/**
	 * Execute multiple pipes. Delegates to util.runPipes
	 * 
	 * @param {Array} pipes 
	 *            array of functions
	 * @param {object}
	 *            data
	 * @param {object}
	 *            jqXHR
	 * @param {string}
	 *            textStatus
	 * @param {object}
	 *            context
	 */
	self.run = function(pipes, data, jqXHR, textStatus, context) {
		util.runPipes(pipes, data, jqXHR, textStatus, context);
	};

	return self;
})();

/**
 * Execute a GET method
 * 
 * @return {function} $.ajax
 */
$.restGet = function() {
	return sprat.wrestle._delegateSimpleRequest(arguments, "GET");
};

/**
 * Execute a POST method
 * 
 * @return {function} $.ajax
 */
$.restPost = function() {
	return sprat.wrestle._delegateSimpleRequest(arguments, "POST");
};

/**
 * Save the object passed to this function by calling $.ajax() with the provided
 * URL. It simply delegates to sprat.rest.call but prior setting the HTTP method
 * which will be PATCH if the object has an ID > 0. Otherwise it will be set to
 * POST.
 * 
 * @param {string} _url
 * @param {object} _object
 * @param {object} _context
 *            see sprat.rest.call
 * @return {function} $.ajax
 */
$.restSave = function(_url, _object, _context) {
	_context = _context || {};

	// inherit defaults
	_context.isPersisted = $.isPersisted(_object);

	_context.ajax = _context.ajax || {};
	// POST creates a new entry; PATCH updates an existing entry. PUT replaces
	// the entire record of an entry. In most cases, this is not what we wanted.
	var method = _context.isPersisted ? "PATCH" : "POST";

	return sprat.wrestle._delegateSimpleRequest([ _url, _object, _context ], method);
};

/**
 * Execute a PUT request on the given _url with the Content-Type
 * "text/uri-list". Use this for update one-to-one or one-to-many references.
 * 
 * @param {string} _url
 * @param {{string|Array}} _references
 *            string or an array of string
 * @param {object} _context
 * @return {function} $.ajax
 */
$.restAssociationSave = function(_url, _references, _context) {
	if (!$.isArray(_references)) {
		_references = [ _references ];
	}

	var context = {
		ajax : {
			contentType : "text/uri-list",
			data : _references.join("\r\n")
		}
	};

	var useContext = $.extend(true, _context, context);
	return sprat.wrestle._delegateSimpleRequest([ _url, null, useContext ], "PUT");
};

/**
 * Update an existing resource.
 * 
 * @param {object} _object
 *            an already-persisted object containing _links.self.href to
 *            locate the backend URL
 * @param {object} _assocs
 *            hashmap: key is the name of the referenced resource
 *            provided in _object._links.$key.href, value is an string or array
 *            with values
 * @param {function} _callback
 *            function to execute after all requests have been done. All results
 *            of the REST call are forwarded to the _callback function. The
 *            first argument is the entity persist call, the association calls
 *            follows.
 * @param {object} [_context]
 *            additional _context parameter. If not explicitly defined,
 *            the _context.pipes.success is set to an empty array so that no
 *            default pipe handlers are executed.
 * @throws exception
 *             if _links.self.href is missing
 * @throws execption
 *             if of one the _assocs has no valid _links.$assocName.href value
 */
$.hateoasUpdate = function(_object, _assocs, _callback, _context) {
	if (!sprat.wrestle.hateoas.isSelfHrefAvailable(_object)) {
		throw "Missing _links.self.href section";
	}

	var resourceAssocs = {};

	for (var resourceName in _assocs) {
		resourceAssocs[sprat.wrestle.hateoas.resourceLink(resourceName, _object)] = _assocs[resourceName];
	}

	_context = _context || {};

	// disable success pipes so that the _callback is executed only
	if (!_context.pipes) {
		_context.pipes = [];
	}

	if (!_context.pipes.success) {
		_context.pipes.success = [];
	}

	var arrMethods = [];

	// persist parent entity
	arrMethods.push($.restSave(sprat.wrestle.hateoas.resourceLink('self', _object), _object, _context));

	// persist associations
	for (var resourceLink in resourceAssocs) {
		arrMethods.push($.restAssociationSave(resourceLink, resourceAssocs[resourceLink], _context));
	}

	// after *all* REST calls have been executed, the _callback is executed.
	// Every parameter of the _callback function is an array containing the AJAX
	// result. In case of success, the third index ([2]) contains the $.ajax
	// context.
	$.when.apply($, arrMethods).then(_callback);
};

/**
 * Check the persistence state of the given object. if _object._links.self.href
 * or _object.id is defined it is assumed that the object is already persisted.
 * 
 * @param {object} _object
 * @return {boolean}
 */
$.isPersisted = function(_object) {
	if (!_object) {
		throw "no object given";
	}

	if (_object._links && _object._links.self.href) {
		return true;
	}

	return (_object.id && _object.id > 0);
};