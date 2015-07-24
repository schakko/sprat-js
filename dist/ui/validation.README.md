# sprat.ui.validation

## sprat.ui.validation.errorDecorator
The *errorDecorator* namespace is used to annotate the user interface based upon Twitter Bootstrap with error messages retrieved from the backend. In most cases it is easier to do a backend validation only and call this backend validation method before actually POSTing the data from the client to the backend.

### Usage
Just pass the expeected data format of messages to a new instance of *errorDecorator* and you are done:

    var errorDecorator = sprat.ui.validation.errorDecorator.create({ form: { selector: "#my-form" }});
    sut.updateErrors(data.errors);

#### Data format of messages
*errorDecorator* expects the validation messages in the following JSON format:

	[
		{field: "name-or-id-from-UI", message: "My error message"},
		{property: "name-or-id-from-UI", defaultMessage: "My error message"},
		{...}
	]

The first object format came from an *org.springframework.validation.BindException*, the second from *org.springframework.data.rest.core.ValidationErrors*.

##### Laravel
To make your life easier, you can use the *laravel* flavor in your *sprat.app* to automatically transform a Laravel/PHP format into the expected format:

Backend (Laravel/PHP):

	if ($validator->fails()) {
    	$r['errors'] = $validator->messages();
    }

	return response()->json($r);

Frontend:

	var app = new sprat.app({ flavor: "laravel" });
	sprat.ui.validation.errorDecorator.configure() // autoconfigure
	// or manually by setting sprat.ui.validation.errorDecorator.configureLaravel();

	var errorDecorator = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-form" }});
	// or use as existing jQuery element: 
	// 		var errorDecorator = sprat.ui.validation.errorDecorator.create($("#fixture-form"));

    sut.updateErrors(data.errors);
	
### Configuration
You can overwrite the global configuration object of *sprat.ui.validation.errorDecorator.defaultOptions* or overwrite every *defaultOption* by passing a option object to *...errorDecorator.create()*

	{
		form: {
			selector: "form:first", // restrict formular if you have multiple forms on your site
			$instance: null			// bind to instance
		},
    	errors: {
            transform: function(_errors), 										// transform error data to expected format
			formatSummary: function(_errors, _unmappedErrors, _errorDecorator),	// format summary which is put on top of the formular
			formatInputError: function(_field, _message, _errorDecorator)		// format field error appended to the input
		},
		execption: {
			formatException: function(_exception, _errorDecorator) 				// format exception
		},
		cssHasError: "has-error" 	// marks the div-container as errorneous
		cssErrorText: "error-text" 	// error text content marker
	}

### Samples
see tests/ui/validation.tests.js.