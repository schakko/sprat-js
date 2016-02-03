var sprat = sprat || {};
sprat.ui = sprat.ui || {}

/**
 * sprat.ui.datetime converts date or datetime object from the backend into frontend representations and vice versa.
 * momentjs must be on your path before using sprat.ui.datetime.init
 */
sprat.ui.datetime = {
	options : {
		'cssInputSelector' : '.datepicker',
		'cssOutputSelector' : '.dateformat',
		'customFormatAttribute' : 'date-format',
		'cssSuffix' : '',
		'backendIsInUTC' : true,
		'backingFieldAttribute' : 'backing-field',
		'formats' : [ {
			'backendFormat' : 'DD.MM.YYYY',
			'frontendFormat' : 'DD.MM.YYYY',
			'datetimepicker' : {
				calendarWeeks : true
			}
		}, {
			'cssSuffix' : '-with-time',
			'backendFormat' : 'DD.MM.YYYY HH:mm',
			'frontendFormat' : 'DD.MM.YYYY HH:mm'
		}, {
			'cssSuffix' : '-full-time',
			'backendFormat' : 'DD.MM.YY HH:ss',
			'frontendFormat' : 'DD.MM.YYYY HH:ss'
		} ],
		'datetimepicker' : {
			calendarWeeks : true
		},
	},
	toFormat : function(input, formatInput, formatOutput, isInputUtc) {
		var functionConvert = isInputUtc ? moment.utc : moment;

		var parsed = functionConvert(input, formatInput);

		// use parsed.toDate() to get the current local time for UTC dates
		var target = isInputUtc ? parsed.toDate() : parsed;
		var result = moment(target).format(formatOutput);

		return result;
	},
	init : function(_options) {
		// inherit default options for passed options.
		var options = $.extend(true, sprat.ui.datetime.options, _options || {});

		// iterate over each format to convert
		$.each(options.formats, function(idx, entry) {
			var localOptions = $.extend(true, {}, options, entry);

			var inputSelector = localOptions.cssInputSelector + localOptions.cssSuffix;
			var outputSelector = localOptions.cssOutputSelector + localOptions.cssSuffix;
			var useUTC = localOptions.backendIsInUTC;

			// convert backend UTC time to local client time
			if (useUTC) {
				$(inputSelector).each(
						function() {
							var utcDateTimeBackend = $(this).val();
							var result = sprat.ui.datetime.toFormat(utcDateTimeBackend, localOptions.backendFormat,
									localOptions.frontendFormat, useUTC);
							$(this).val(result);
						})
			}

			// instantiate the datetimepicker plug-in
			localOptions.datetimepicker.format = localOptions.frontendFormat;
			$(inputSelector).datetimepicker(localOptions.datetimepicker);

			// convert output fields. The output field must be prefilled with the backend data
			$(outputSelector).each(
					function() {
						// use custom format for HTML element. By default: <span
						// ... date-format="myformat">sourceFormat</span>
						var customOutputFormat = $(this).attr(localOptions.customFormatAttribute);
						var useOuputFormat = customOutputFormat || localOptions.frontendFormat;

						var result = sprat.ui.datetime.toFormat($(this).text(), localOptions.backendFormat,
								useOuputFormat, localOptions.backendIsInUTC);
						$(this).text(result);
					});

			$(inputSelector).each(function() {
				// das backing-field enthält den eigentlichen
				// POST-Parameter
				var backingField = $("input[name='" + $(this).attr(localOptions.backingFieldAttribute) + "']");

				if (!backingField) {
					return;
				}

				// set callback function to convert inserted data to
				// backend-format
				$(this).on('dp.change', function(e) {
					// by default, expect no UTC usage in backend
					var result = moment(e.date).format(localOptions.backendFormat)

					// if backend uses UTC, the passed date is in non-UTC format
					// and must be converted to UTC
					if (useUTC) {
						result = moment.utc(e.date).format(localOptions.backendFormat);
					}

					// update backing field
					backingField.val(result);
				})
			});
		});
	}
};