/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};
sprat.ui.validation = sprat.ui.validation || {};

sprat.ui.validation.errorDecorator = {
    defaultOptions: {
        form: {
            selector: "form:first",
            $instance: null,
            /**
             * Resolve input fields by their name. By default, the name attribute is looked up and then falls back to the ID attribute.
             * @param _field
             * @param $form
             * @return {jQuery}
             */
            resolveInput: function (_field, $form) {
                var $input = $form.find(":input[name='" + _field + "']");

                if ($input.length === 0) {
                    $input = $form.find("#" + _field);
                }

                if ($input.length === 0) {
                    return null;
                }

                return $input;
            }
        },
        errors: {
            /**
             * Display the summary inside the formular
             * @param _content
             * @param $form
             * @param _options
             */
            displaySummary: function(_content, $form, _options) {
                $form.prepend(_content);
            },
            /**
             * Method to transform an object to the expected error object
             * @param {array} _errors
             * @returns {array} [{field: "field", message: "Message}, {...}]
             */
            transform: function (_errors) {
                return _errors;
            },
            /**
             * Format the summary on top of the formular
             * @param {array} _errors
             * @param {array} _unmappedErrors Errors without any form binding
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatSummary: function (_errors, _unmappedErrors, _errorDecorator) {
                var msg = "Es sind " + _errors.length + " Validierungsfehler aufgetreten.", error = null;

                if (_unmappedErrors.length > 0) {
                    msg += "<ul>";

                    for (i = 0, m = _unmappedErrors.length; i < m; i++) {
                        error = _unmappedErrors[i];
                        msg += "<li>" + error.field + ": " + error.message + "</li>";
                    }

                    msg += "</ul>";

                    if (_unmappedErrors.length < _errors.length) {
                        msg += "Alle weiteren Fehler wurden an den jeweiligen Eingabefeldern markiert.";
                    }
                }

                return msg;
            },
            /**
             * Format the message which is bound directly to the input field
             * @param {string} _field
             * @param {string} _message
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatInputError: function (_field, _message, _errorDecorator) {
                return "<div class='" + _errorDecorator.options.cssHasError + " " + _errorDecorator.options.cssErrorText + "'><label class='control-label'>" + _message + "</label></div>";
            }
        },
        exception: {
            /**
             * Format an exception thrown by the backend
             * @param {object} _exception
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatException: function (_exception, _errorDecorator) {
                return "<div class='" + _errorDecorator.options.cssErrorText + " alert alert-danger'>Es sind Fehler in der Anwendung aufgetreten: " + _exception.message + "</div>";
            }
        },
        cssErrorContainer: "error-container",
        cssHasError: "has-error",
        cssErrorText: "error-text"
    },
    /**
     * Setup the default configuration. By default we expect Spring data structures. "laravel" is supported as flavor.
     */
    configure: function () {
        var isInitialized = requireSpratAppInitialized() || (function () {
                throw "sprat/app.js not included?";
            })();

        switch (sprat.$spratAppInstance.flavor()) {
            case "spring":
                sprat.ui.validation.errorDecorator.configureSpring();
                break;
            case "laravel":
                sprat.ui.validation.errorDecorator.configureLaravel();
                break;
        }
    },
    /**
     * Configure data transformer for Laravel
     */
    configureLaravel: function () {
        sprat.ui.validation.errorDecorator.defaultOptions.errors.transform = function (_errors) {
            var r = [];

            if (_errors !== null && typeof _errors === 'object') {
                for (var key in _errors) {
                    r.push({field: key, message: _errors[key]});
                }
            }

            return r;
        };
    },
    /**
     * Configure Spring transformer
     */
    configureSpring: function () {
        sprat.ui.validation.errorDecorator.defaultOptions.errors.transform = function (_errors) {
            return _errors;
        };
    }
};

/**
 * Use ErrorDecorator for binding validation errors from the backend the input fields in the frontend.
 *
 * @param {object|jQuery} options
 *  .form.$instance {jQuery object} use this element as form and not the selector
 *  .form.selector  {string} jQuery selector to select the bound form. By default, form:first is used
 *  .errors.transform {function} callback method to transform an error array into the expected format.
 *      By default ErrorDecorator expects validation errors based upon the result of Spring MVC/Data. Use app.flavor == "laraval"
 *      to initialize a callback method for Laravel
 *  .errors.formatSummary {function(_errors, _unmappedErrors)} callback method to display the error summary
 *  .errors.formatInputError {function(_field, _message)} callback method to format the input error bind directly to the input field
 *  .exception.formatException {function(_exception}} function to format an exception
 *  .cssErrorContainer {string} CSS class for marking a container with error
 *  .cssHasError {string} CSS class
 *  .cssErrorText {string} CSS class
 *
 *  If the options parameters is of type jQuery, the form decorator is bound to the provided element.
 * @constructor
 */
sprat.ui.validation.errorDecorator.create = function (options) {
    function instance(options) {
        var self = this;

        options = options || {};

        if (options instanceof jQuery) {
            var useInstance = options;

            options = {
                form: {
                    "$instance": useInstance
                }
            };
        }

        // let the provided options override the default options but don't touch the original default options
        self.options = $.extend(true, $.extend(true, [], sprat.ui.validation.errorDecorator.defaultOptions), options);

        // resolve the form to bind by an selector or an existing jQuery instance. the instance has precedence.
        self.$form = self.options.form.$instance || $(self.options.form.selector);

        /**
         * Remove all .has-error and .error-text elements from the canvas
         */
        self.clear = function () {
            var cssHasError = self.options.cssHasError;

            self.$form.find("." + cssHasError).removeClass(cssHasError);
            self.$form.find(".error-text").remove();
        };

        /**
         * Append the self.options.cssHasError CSS class to every div container which is marked with CSS class self.options.cssErrorContainer.
         */
        self.highlightInputErrors = function () {
            $("div." + self.options.cssErrorContainer).each(function () {
                $(this).closest(".form-group").addClass(self.options.cssHasError);
            });
        };

        /**
         * Show the exceptions.
         * @param {object} _exception exception object
         */
        self.updateException = function (_exception) {
            self.clear();

            self.$form.prepend(self.options.exception.formatException(_exception, self));
        };

        /**
         * Update the bind form with the errors. Every occured error before will be removed.
         * This method automatically calls self.options.errors.transform to convert any error parameter in the expected format.
         *
         * @param {{Array|Object}} errors
         * @returns {*}
         */
        self.updateErrors = function (errors) {
            self.clear();

            if (!errors) {
                return 0;
            }

            errors = self.options.errors.transform(errors);
            return self.bindErrors(errors);
        };

        /**
         * Bind an array of errors to the input field. This method has been primarily designed for Spring MVC/Spring data
         * validation, so the given parameters must have the expected format.
         *
         * @param {array} errors in format [{ field: "my_field", message: "my_message"}, { field: "field_2", message: "message" }]
         * @return {object} validation results
         */
        self.bindErrors = function (errors) {
            var i = 0, m = 0, error = null, ctx = null;

            var r = {
                unmappedErrors: [],
                mappedErrors: [],
                length: errors.length,
                summary: ""
            };

            // unmapped errors are errors which could not be bound to the field. they are displayed later on top of the form
            var unmappedErrors = [];

            for (i = 0, m = errors.length; i < m; i++) {
                error = errors[i];

                // Different field names:
                // - Laravel: field
                // - org.springframework.validation.BindException: field
                // - org.springframework.data.rest.core.ValidationErrors: property
                var field = error.field || error.property;

                var message = error.message || error.defaultMessage;
                // find the input (input=text, textarea, select) by its name attribute in first place

                input = self.options.form.resolveInput(field, self.$form);

                // ctx = current message context
                ctx = {field: field, message: message, $input: $(input)};

                // input field could not found by its name attribute
                if (!input) {
                    r.unmappedErrors.push(ctx);
                    continue;
                }

                r.mappedErrors.push(ctx);

                var parentDiv = input.closest('.form-group');

                // mark parent div as erroneous
                parentDiv.addClass(self.options.cssHasError);
                // and add the error text
                $(input).after(self.options.errors.formatInputError(field, message, self));
            }

            // show unmapped errors if any
            if (errors.length > 0) {
                r.summary = self.options.errors.formatSummary(errors, r.unmappedErrors, self);
                var summary = "<div class='" + self.options.cssErrorText + " alert alert-danger validation-summary'>" + r.summary + "</div>";
                self.options.errors.displaySummary(summary, self.$form, self.options);
            }

            return r;
        };
    }

    return new instance(options);
};
