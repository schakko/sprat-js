var sprat = sprat || {};

sprat.util = sprat.util || {
	/**
	 * @param any check
	 * @return boolean true if the provided parameter is a function
	 */
	// http://stackoverflow.com/questions/5999998/how-can-i-check-if-a-javascript-variable-is-function-type
	isFunction: function(check) {
		var getType = {};
		return check && getType.toString.call(check) === '[object Function]';
	},
	/**
	 * iterates over an array of objects and checks for the key "id".
	 * @param elements array of objects
	 * @param id primitive|function if it s a function, the function is excecuted as check method (id(element): boolean). Otherwise the default function is used which checks the property "id" of an object.
	 * @param successCallback null|function if provided, the callback is executed when the first element has been found. It the callback returns "undefined", the lookup does not stop and checks the next element.
	 * @return object
	 */
	lookup: function(elements, id, successCallback) {
		var check = id, r;

		if (!$util.isFunction(check)) {
			// default checks only for "id" attribute
			check = function(element) {
				return element.id == id;
			};
		}

		for ( var idx in elements) {
			var element = elements[idx];
			
			r = element;

			// matches the current element the selector?
			if (check(element)) {
				// if an success callback is given, execute it
				if (successCallback) {
					// if the callback returns undefined, the loop does not break
					r = successCallback(element, idx);
				}

				if (r !== undefined) {
					break;
				}
			}
		}

		return r;
	}
};

sprat.util.array = sprat.util.array || {
	/**
	 * Search in a list of elements for one or multiple values.
	 * @param array array to search
	 * @param propertyValuesToFind array with property values to find
	 * @param string name of property or attribute to compare
	 * @return array of objects. The order is preserved as it was in the original array
	 */
	search: function(array, propertyValuesToSearch, property) {
		var candidates = {};
		var r = [], item, key, value, i = 0, m = 0;
		property = property || 'id';
		
		// build lookup table for better performance
		for (i = 0, m = propertyValuesToSearch.length; i< m; i++) {
			key = propertyValuesToSearch[i];
			candidates[key] = key;
		}
		
		for (i = 0, m = array.length; i < m; i++) {
			item = array[i];
			value = item[property];
			
			if (candidates[value]) {
				// value has been searched for
				r.push(item);
			}
		}	
		
		return r;
	},
	/**
	 * Remove an element by its .id attribute
	 * @param array
	 * @param id primitive
	 * @return idx
	 */
	removeById: function(array, id) {
		var idx = sprat.util.lookup(array, id, function(elem, idx) {
			return idx;
		});

		return sprat.util.array.removeByIndex(array, idx);
	},
	/**
	 * Remove an element by its index
	 * @param array
	 * @param idx numeric
	 * @throws if idx is larger than array index
	 */
	removeByIndex: function(array, idx) {
		if (idx < 0) {
			return -1;
		}
		
		if (idx > array.length - 1) {
			throw "Invalid array index position";
		}

		array.splice(idx, 1);

		return idx;
	},
	/**
	 * Add or remove an element.
	 * @param array
	 * @param element object
	 * @param idx numeric|null if given, the element at the given position is updated. Otherwise the element.id attribute is used for a lookup.
	 */
	update: function(array, element, idx) {
		if (idx === undefined) {
			idx = sprat.util.lookup(array, element.id, function(elem, idx) {
				return idx;
			});
		}
		
		if (idx !== undefined) {
			array[idx] = element;
		} else {
			sprat.util.array.add(array, element);
		}
	},
	/**
	 * Insert the element into the given idx.
	 *
	 * @param array
	 * @param element object
	 * @param idx integer if undefined, the element is added to the end
	 * @return integer idx of added element
	 */
	add: function(array, element, idx) {
		if (idx === undefined) {
			array.push(element);
			
			return array.length - 1;
		}

		array.splice(idx, 0, element);

		return idx;
	}
};

// export
var $util = sprat.util;
var $array = sprat.util.array;
