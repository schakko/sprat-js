var sprat = sprat || {};
sprat.ui = sprat.ui || {};
sprat.ui.validation = sprat.ui.validation || {};

/**
 * Utility methods for validation of AngularJS backed forms and Spring Data * backends
 */

/**
 * Removes any AngularJS error from the $form
 * @param $form AngularJS binding to the form
 * @param $errors AngularJS binding for errors
 * @param _fieldMapping object|null
 */
sprat.ui.validation.resetErrors = function($form, $errors, _fieldMapping) {
	var field = null;
	
	_fieldMapping = _fieldMapping || [];

	// reset existing errors
	for (var key in $errors) {
		field = key;
		
		if (_fieldMapping[field]) {
			field = _fieldMapping[field];
		}
		
		$form[field].$setValidity('server', true);
		
		delete $errors[field];
	}
};

/**
 * parses errors from the backend
 * @param $form AngularJS binding to the form
 * @param $errors AngularJS binding to the errors
 * @param data retrieved validation data from the backend
 * @param _fieldMapping object|null
 */
sprat.ui.validation.parseErrors = function($form, $errors, data, _fieldMapping) {
	_fieldMapping = _fieldMapping || [];
	
	ui.resetErrors($form, $errors, _fieldMapping);
	
	var error = null, field = null, code = null, message = null;
	
	if (data.errors) {
		// append new errors
		for (var idx in data.errors) {
			error = data.errors[idx];
			field = error.field;
			
			if (_fieldMapping[field]) {
				field = _fieldMapping[field];
			}
			
			code = error.code
			message = error.defaultMessage || code;
			
			$errors[field] = message;
			$form[field].$setValidity('server', false)
		}
	}
};