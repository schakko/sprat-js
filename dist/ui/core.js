/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};

/**
 * See
 * http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
 * 
 * @param {object} o
 * @param {string} s
 * @returns {object}
 */
Object.byString = function(o, s) {
	s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
	s = s.replace(/^\./, ''); // strip a leading dot
	var a = s.split('.');
	while (a.length) {
		var n = a.shift();
		if (n in o) {
			o = o[n];
		} else {
			return;
		}
	}
	return o;
};

sprat.ui = {
	/**
	 * Enable a modal dialog in the UI. The method uses Twitter Bootstrap
	 * classes and the modal() extension of Bootstrap. _options:
	 * 
	 * <pre>
	 * {
	 * 	.title: string, replaces .modal-title,
	 *  .body: string, replaces .modal-body,
	 *  .footer: string, replaces .modal-footer; if null, the footer is disabled,
	 *  .closeable: boolean, enable or disable Close button and footer,
	 *  .root: string, jQuery selector which contains the modal #modal layer|default: &quot;#modal&quot;
	 *  }
	 * </pre>
	 */
	modal : function(_options) {
		var defaults = {
			title : "Kein Titel",
			body : "Kein Text",
			footer : '<button type="button" class="btn btn-default" data-dismiss="modal">Schließen</button>',
			closeable : true,
			root : "#modal"
		};

		var options = $.extend(true, defaults, _options);

		var modal = $(options.root);

		modal.find(".modal-body").html(options.body);
		modal.find(".modal-title").html(options.title);

		var args = "show";

		if (options.closeable) {
			modal.find(".modal-footer").html(options.footer);
		} else {
			modal.find(".modal-header .close").hide();
			modal.find(".modal-footer").hide();
			args = {
				keyboard : false
			};
		}

		$(options.root).modal(args);
	},
	/**
	 * Find the root element for further jQuery selections. By default, the root
	 * context "body" will be returned
	 * 
	 * @param {object} options
	 *            if options has property .formContext, this will be used as
	 *            root
	 * @param {string} [selector]
	 *            If the optional selector is specified, the prior root context (body or
	 *            .formContext) will be used
	 */
	findRoot : function(options, selector) {
		var root = $("body");

		if (options && options.form) {
			root = options.form;
		}

		// check for valid root
		if (!(root instanceof jQuery)) {
			throw "The root you provided is not a jQuery object. Pass { form: $('my_selector') to options array }";
		}

		if (selector) {
			var appender = root.find(selector);

			if (appender.length >= 1) {
				root = $(appender[0]);
			}
		}

		return root;
	}
};