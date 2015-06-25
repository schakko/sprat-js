QUnit.module("sprat.ui.validation.errorDecorator");
var data = {"errors":{"title":["The title field is required."],"created_on":["The Created on on field is required."]}};

QUnit.test("'laravel' flavor calls configureLaravel() ", function(assert) {
    var app = new sprat.app({ flavor: "laravel"}).initialize();
    var spy = sinon.spy(sprat.ui.validation.errorDecorator, "configureLaravel");

    sprat.ui.validation.errorDecorator.configure();

    ok(spy.calledOnce, "configureLaravel has been called");
});

QUnit.test("Laravel transform() method transform response()->json(array('errors' => $validator->messages()) to expected datat structure ", function(assert) {
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    var sut = sprat.ui.validation.errorDecorator.defaultOptions.errors.transform(data.errors);

    equal(sut.length, 2, "two error messages");
    equal(sut[0].field, "title");
    equal(sut[0].message, data.errors.title[0]);
});

QUnit.test("User interface has been updated with messages", function(assert) {
    // enable flavor
    sprat.ui.validation.errorDecorator.configureLaravel();

    // we must use the selector b/c QUnit adds its own input fields
    var sut = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-form" }});
    var result = sut.updateErrors(data.errors);

    equal(result.length, 2);
    equal($(".validation-summary").length, 1, "Summary is present");
    equal($(".validation-summary").text(), result.summary, "Summary content is set");
    ok($("#form-group-title").hasClass('has-error'), "form-group container has been decorated with 'has-error' class");
    ok($("#form-group-created-on").hasClass('has-error'), "form-group container has been decorated with 'has-error' class");
    equal($("#form-group-title > div.has-error > label").text(), "The title field is required.", "Validation message has been appended to input field");
});

// QUnit.module("other namespace/group of validation.js to test")
