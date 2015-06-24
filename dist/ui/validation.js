/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};

sprat.ui.validation = {
	/**
	 * Remove all .has-error and .error-text elements from the canvas
	 * 
	 * @param options
	 *            will be passed to sprat.ui.findRoot
	 */
	clearErrorTexts : function(options) {
		var root = sprat.ui.findRoot(options);
		$(root).find(".has-error").removeClass("has-error");
		$(root).find(".error-text").remove();
	},
	/**
	 * Findet standardmäßig alle div-Elemente mit der CSS-Klasse "error-container" und markiert das Eltern-Element mit der CSS-Klasse "form-group" mit "has-error"
	 * @param options
	 */
	highlightValidationErrors : function(options) {
		options = options || {};
		var cssErrorMarker = options.cssErrorMarker || "error-container";
		var targetClass = options.cssTarget || "has-error";
		
		$("div." + cssErrorMarker).each(function() {
			$(this).closest(".form-group").addClass(targetClass);
		});
	},
	/**
	 * Show the exceptions.
	 * 
	 * @param options
	 *            will be passed to sprat.ui.findRoot. The selector for findRoot
	 *            is .append-exception
	 */
	showExceptions : function(exception, options) {
		var root = sprat.ui.findRoot(options, ".append-exceptions");
		sprat.ui.clearErrorTexts(options);

		$(root).prepend(
				"<div class='error-text alert alert-danger'>Es sind Fehler in der Anwendung aufgetreten: " + exception.message + "</div>");
	},
	validation : {
		/**
		 * Show validation errors
		 * 
		 * @param errors
		 * @param options
		 *            will be passed to sprat.ui.findRoot. The selector for
		 *            findRoot is .append-validation-errors
		 */
		showErrors : function(errors, options) {
			sprat.ui.clearErrorTexts(options);
			var root = sprat.ui.findRoot(options, ".append-validation-errors");
			var i = 0, m = 0, error = null;

			var unmappedErrors = [];

			for (i = 0, m = errors.length; i < m; i++) {
				error = errors[i];

				// org.springframework.validation.BindException: field
				// org.springframework.data.rest.core.ValidationErrors: property
				var field = error.field || error.property;
				var message = error.message || error.defaultMessage;

				var input = root.find("input[name='" + field + "']");

				if ($(input).length === 0) {
					input = root.find("#" + field);
					
					if ($(input).length === 0) {
						unmappedErrors.push({
							field : field,
							message : message
						});
						continue;
					}
				}

				var parentDiv = input.closest('.form-group');

				parentDiv.addClass("has-error");

				$(input).after(
						"<div class='has-error error-text'><label class='control-label'>" + message + "</label></div>");
			}

			if (errors.length > 0) {
				var msg = "Es sind " + errors.length + " Validierungsfehler aufgetreten.";

				if (unmappedErrors.length > 0) {
					msg += "<ul>";

					for (i = 0, m = unmappedErrors.length; i < m; i++) {
						error = unmappedErrors[i];
						msg += "<li>" + error.field + ": " + error.message + "</li>";
					}

					msg += "</ul>";

					if (unmappedErrors.length < errors.length) {
						msg += "Alle weiteren Fehler wurden an den jeweiligen Eingabefeldern markiert.";
					}
				}

				$(root).prepend("<div class='error-text alert alert-danger'>" + msg + "</div>");
			}
		}
	}
};

