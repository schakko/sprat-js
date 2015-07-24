QUnit.module("sprat.ui.validation.errorDecorator");
var data = {"errors":{"title":["The title field is required."],"created_on":["The Created on on field is required."]}};

QUnit.test("'laravel' flavor calls configureLaravel() ", function(assert) {
    var app = new sprat.app({ flavor: "laravel"}).initialize();
    var spy = sinon.spy(sprat.ui.validation.errorDecorator, "configureLaravel");

    sprat.ui.validation.errorDecorator.configure();

    ok(spy.calledOnce, "configureLaravel has been called");
});

QUnit.test("Laravel transform() method transform response()->json(array('errors' => $validator->messages()) to expected data structure ", function(assert) {
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    var sut = sprat.ui.validation.errorDecorator.defaultOptions.errors.transform(data.errors);

    equal(sut.length, 2, "two error messages are present");
    equal(sut[0].field, "title", "the field of the first message has been resolved to 'title'");
    equal(sut[0].message, data.errors.title[0], "the content of the first message has been resolved as expected");
});

QUnit.test("User interface has been updated with messages", function(assert) {
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    // we must use the selector b/c QUnit adds its own input fields
    var sut = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-form" }});
    var result = sut.updateErrors(data.errors);

    equal(result.length, 2, "two errors have been processed");
    equal($(".validation-summary").length, 1, "Summary is present");
    equal($(".validation-summary").text(), result.summary, "Summary content is set");
    ok($("#form-group-title").hasClass('has-error'), "form-group container has been decorated with 'has-error' class");
    ok($("#form-group-created-on").hasClass('has-error'), "form-group container has been decorated with 'has-error' class");
    equal($("#form-group-title > div.has-error > label").text(), "The title field is required.", "Validation message has been appended to input field");
});

QUnit.test("Inputs like select or textarea are updated with messages", function(assert) {
	// --- setup
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    // we must use the selector b/c QUnit adds its own input fields
    var sut = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-other-inputs-than-singleline-text" }});
	var use_data = {"errors":{"content":["The content field is required."],"select_id":["The select_id field is required."]}};
	
	// --- execute
    var result = sut.updateErrors(use_data.errors);

	// --- assert
    equal(result.length, 2);
    equal($(".validation-summary").length, 1, "Summary is present");
    equal($(".validation-summary").text(), result.summary, "Summary content is set");
    ok($("#form-group-content").hasClass('has-error'), "form-group form-group-content container has been decorated with 'has-error' class");
    ok($("#form-group-select-id").hasClass('has-error'), "form-group form-group-select-id container has been decorated with 'has-error' class");
    equal($("#form-group-content > div.has-error > label").text(), "The content field is required.", "Validation message has been appended to textarea field");
    equal($("#form-group-select-id > div.has-error > label").text(), "The select_id field is required.", "Validation message has been appended to select input");
});

QUnit.test("An jQuery element can be provided for the form decoration", function(assert) {
	// --- setup
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    var sut = sprat.ui.validation.errorDecorator.create($("#fixture-other-inputs-than-singleline-text"));
	var use_data = {"errors":{"content":["The content field is required."],"select_id":["The select_id field is required."]}};

	// --- execute
    var result = sut.updateErrors(use_data.errors);

	// --- assert
    equal(result.length, 2);
    equal($(".validation-summary").length, 1, "Summary is present");
    ok($("#form-group-content").hasClass('has-error'), "form-group form-group-content container has been decorated with 'has-error' class");
    equal($("#form-group-content > div.has-error > label").text(), "The content field is required.", "Validation message has been appended to textarea field");
	// other assertions like the prior test are not needed
});

// QUnit.module("other namespace/group of validation.js to test")
