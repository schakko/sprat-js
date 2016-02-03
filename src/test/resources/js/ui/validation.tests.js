describe("sprat.ui.validation.errorDecorator", function () {
    'use strict';

	function initFormFixture() {
		setFixtures('<form role="form" id="fixture-form">\
            <div class="form-group form-group-title">\
                <label for="title">Title</label>\
                <input type="text" class="form-control form-control-title" name="title" />\
            </div>\
            <div class="form-group">\
                <label for="content">Content</label>\
                <textarea class="form-control form-control-content" rows="10" name="content"></textarea>\
            </div>\
            <div class="form-group form-group-created-on">\
                <label for="created_on">Created on</label>\
                <div class="input-group">\
                    <div class="input-group-addon">\
                        <i class="fa fa-calendar"></i>\
                    </div>\
                    <input type="text" class="created_on" name="created_on" class="form-control" data-inputmask="\"alias\": \"dd.mm.yyyy\""\
                           data-mask="">\
                </div>\
            </div>\
            <button type="button" class="btn btn-primary" id="save">Save</button>\
        </form>');
	}
	
	function initOtherInputFixture() {
		setFixtures('<form role="form" id="fixture-other-inputs-than-singleline-text">\
            <div class="form-group form-group-content">\
                <label for="content">Content</label>\
                <textarea class="form-control form-control-content" rows="10" name="content"></textarea>\
            </div>\
            <div class="form-group form-group-select-id">\
                <label for="select_id">Selection</label>\
                <select name="select_id"><option value="1"></option></select>\
            </div>\
            <button type="button" class="btn btn-primary" id="save">Save</button>\
        </form>');
	}
	
	function initDifferentFieldnameFixture() {
		setFixtures('<form role="form" id="fixture-different-fieldnames">\
            <div class="form-group form-group-content">\
                <label for="content">Content</label>\
                <textarea class="form-control src-content" id="some-id" rows="10" name="src-content"></textarea>\
            </div>\
            <button type="button" class="btn btn-primary" id="save">Save</button>\
        </form>');
	}
	
    var data = {
        "errors": {
            "title": ["The title field is required."],
            "created_on": ["The Created on on field is required."]
        }
    };

    it("'laravel' flavor calls configureLaravel() ", function () {
        var app = new sprat.app({flavor: "laravel"}).initialize();
        spyOn(sprat.ui.validation.errorDecorator, 'configureLaravel');

        sprat.ui.validation.errorDecorator.configure();

        expect(sprat.ui.validation.errorDecorator.configureLaravel).toHaveBeenCalledTimes(1);
    });

    it("Laravel transform() method transform response()->json(array('errors' => $validator->messages()) to expected datat structure ", function () {
        // --- setup
		initFormFixture();
		
        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();

        var sut = sprat.ui.validation.errorDecorator.defaultOptions.errors.transform(data.errors);

        expect(sut.length).toEqual(2);
        expect(sut[0].field).toEqual("title");
        expect(sut[0].message).toEqual(data.errors.title);
    });

    it("User interface has been updated with messages", function() {
        // --- setup
		initFormFixture();

        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();

        // we must use the selector b/c QUnit adds its own input fields
        var sut = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-form" }});
        var result = sut.updateErrors(data.errors);

        var $ctx = $("#fixture-form");

        expect(result.length).toEqual(2);
        expect($ctx.find(".validation-summary").length).toEqual(1);
        expect($ctx.find(".validation-summary").text()).toEqual(result.summary);
        expect($ctx.find(".form-group-title").hasClass('has-error')).toEqual(true);
        expect($ctx.find(".form-group-created-on").hasClass('has-error')).toEqual(true);
        expect($ctx.find(".form-group-title > div.has-error > label").text()).toEqual("The title field is required.");
    });

    it("Inputs like select or textarea are updated with messages", function () {
        // --- setup
		initOtherInputFixture();

        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();

        // we must use the selector b/c QUnit adds its own input fields
        var sut = sprat.ui.validation.errorDecorator.create({ form: { selector: "#fixture-other-inputs-than-singleline-text" }});
        var use_data = {"errors":{"content":["The content field is required."],"select_id":["The select_id field is required."]}};
        var result = sut.updateErrors(use_data.errors);

        var $ctx = $("#fixture-other-inputs-than-singleline-text");

        expect(result.length).toEqual(2);
        expect($ctx.find(".validation-summary").length).toEqual(1);
        expect($ctx.find(".validation-summary").text()).toEqual(result.summary);
        expect($ctx.find(".form-group-content").hasClass('has-error')).toEqual(true);
        expect($ctx.find(".form-group-select-id").hasClass('has-error')).toEqual(true);
        expect($ctx.find(".form-group-content > div.has-error > label").text()).toEqual("The content field is required.");
        expect($ctx.find(".form-group-select-id > div.has-error > label").text()).toEqual("The select_id field is required.");
    });

    it("An jQuery element can be provided for the form decoration", function() {
        // --- setup
		initOtherInputFixture();

        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();
        var $ctx = $("#fixture-other-inputs-than-singleline-text");

        var sut = sprat.ui.validation.errorDecorator.create($("#fixture-other-inputs-than-singleline-text"));
        var use_data = {"errors":{"content":["The content field is required."],"select_id":["The select_id field is required."]}};

        // --- execute
        var result = sut.updateErrors(use_data.errors);

        // --- assert
        expect(result.length).toEqual(2);
        expect($ctx.find(".validation-summary").length).toEqual(1);
        expect($ctx.find(".form-group-content").hasClass('has-error')).toEqual(true);
        expect($ctx.find(".form-group-content > div.has-error > label").text()).toEqual("The content field is required.");
        // other assertions like the prior test are not needed
    });

    it("The displaySummary can be overwritten", function() {
        // --- setup
		initDifferentFieldnameFixture();

        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();
        var $ctx = $("#fixture-different-fieldnames");

        // we must use the selector b/c QUnit adds its own input fields
        var sut = sprat.ui.validation.errorDecorator.create({
            form: {
                selector: "#fixture-different-fieldnames"
            },
            errors: {
                displaySummary: function(content, $form, options) {
                    $form.prepend(content);
                    $form.append(content);
                }
            }
        });
        var use_data = {"errors":{"content":["The content field is required."]}};

        // --- execute
        var result = sut.updateErrors(use_data.errors);

        // --- assert
        expect($ctx.find(".validation-summary").length).toEqual(2);
    });


    it("It is possible to modify the lookup of field names", function() {
        // --- setup
		initDifferentFieldnameFixture();

        // enable flavor
        sprat.ui.validation.errorDecorator.configureLaravel();
        var $ctx = $("#fixture-different-fieldnames");

        // we must use the selector b/c QUnit adds its own input fields
        var sut = sprat.ui.validation.errorDecorator.create({
            form: {
                selector: "#fixture-different-fieldnames",
                resolveInput: function (field, $form) {
                    var $r = $form.find(".src-" + field);
                    return $r;
                }
            }
        });
        var use_data = {"errors":{"content":["The content field is required."]}};

        // --- execute
        var result = sut.updateErrors(use_data.errors);

        // --- assert
        expect($ctx.find(".form-group-content").hasClass('has-error')).toEqual(true);
    });

});