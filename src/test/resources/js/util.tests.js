describe("sprat.util", function () {

    it("a function is a function", function () {
        expect($util.isFunction(function () {
        })).toEqual(true);
    });

    it("an array is *not* a function", function () {
        expect($util.isFunction([])).toEqual(false);
    });

});

describe("sprat.util.lookup", function () {
    it("an null or empty elements array returns undefined", function () {
        expect($util.lookup(undefined, 1)).toEqual(undefined);
    });

    it("an array with an object with the given id is returned", function () {
        var object = {id: 1};

        expect($util.lookup([object], 1)).toEqual(object);
    });

    it("an array with multiple objects and containing the given id is returned", function () {
        var object = {id: 1};

        expect($util.lookup([object, {id: 2}], 1)).toEqual(object);
    });

    it("a custom check method is executed and returns the found element", function () {
        var object = {name: "test"};

        expect($util.lookup([object], function (elem) {
            return elem.name === "test";
        })).toEqual(object);
    });

    it("a custom callback returning undefined is executed but the method itself returns undefined", function () {
        var object = {id: 1};
        var r = [];

        expect($util.lookup([object], 1, function (elem, idx) {
            r.push(elem);
        })).toEqual(undefined);
        expect(r.length).toEqual(1);
        expect(r[0]).toEqual(object);
    });
});

describe("sprat.util.array.add", function () {
    it("an element can added to the given position", function () {
        var array = ['a', 'b', 'c'];

        sprat.util.array.add(array, 'X', 1);

        expect(array[1]).toEqual('X');
    });

    it("if no idx is defined, it is added to the end", function () {
        var array = ['a', 'b', 'c'];

        sprat.util.array.add(array, 'X');

        expect(array[3]).toEqual('X');
    });
});

describe("sprat.util.array.removeByIndex", function () {

    it("an element can be removed by its index", function () {
        var array = ['a', 'b', 'c'];

        sprat.util.array.removeByIndex(array, 1);

        expect(array.length).toEqual(2);
        expect(array[0]).toEqual('a');
        expect(array[1]).toEqual('c');
    });

    it("an invalid index throws an exception", function () {
        var array = ['a', 'b', 'c'];

        try {
            sprat.util.array.removeByIndex(array, 3);
            expect(true).toEqual(false);
        }
        catch (Ex) {
            expect(true).toEqual(true);
        }
    });
});

describe("sprat.util.array.removeById", function() {
    it("an element can be removed by its id", function () {
        var array = [{id: 1}, {id: 2}, {id: 3}];

        sprat.util.array.removeById(array, 2);

        expect(array.length).toEqual(2);
        expect(array[0].id).toEqual(1);
        expect(array[1].id).toEqual(3);
    });
});

describe("sprat.util.array.update", function() {
    it("an element can be update by its id", function () {
        var array = [{id: 1}, {id: 2}, {id: 3}];
        var object = {name: "test", id: 2};

        sprat.util.array.update(array, object);

        expect(array[1]).toEqual(object);
    });

    it("an element can be update by its idx", function () {
        var array = [{id: 1}, {id: 2}, {id: 3}];
        var object = {name: "test", id: 2};

        sprat.util.array.update(array, object, 0);

        expect(array[0]).toEqual(object);
        expect(array[1].name).toEqual(undefined);
    });
});

describe("sprat.util.array.search", function() {
    it("multiple elements can be found", function () {
        var array = [{id: 1}, {id: 2}, {id: 3}];

        var result = sprat.util.array.search(array, [1, 3]);
        expect(result.length).toEqual(2);
        expect(result[0].id).toEqual(1);
        expect(result[1].id).toEqual(3);
    });
});
