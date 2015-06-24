/*! Copyright (c) 2011, Lloyd Hilaiel, ISC License */
/*
 * This is the JSONSelect reference implementation, in javascript.  This
 * code is designed to run under node.js or in a browser.  In the former
 * case, the "public API" is exposed as properties on the `export` object,
 * in the latter, as properties on `window.JSONSelect`.  That API is thus:
 *
 * Selector formating and parameter escaping:
 *
 * Anywhere where a string selector is selected, it may be followed by an
 * optional array of values.  When provided, they will be escaped and
 * inserted into the selector string properly escaped.  i.e.:
 *
 *   .match(':has(?)', [ 'foo' ], {})
 *
 * would result in the seclector ':has("foo")' being matched against {}.
 *
 * This feature makes dynamically generated selectors more readable.
 *
 * .match(selector, [ values ], object)
 *
 *   Parses and "compiles" the selector, then matches it against the object
 *   argument.  Matches are returned in an array.  Throws an error when
 *   there's a problem parsing the selector.
 *
 * .forEach(selector, [ values ], object, callback)
 *
 *   Like match, but rather than returning an array, invokes the provided
 *   callback once per match as the matches are discovered.
 *
 * .compile(selector, [ values ])
 *
 *   Parses the selector and compiles it to an internal form, and returns
 *   an object which contains the compiled selector and has two properties:
 *   `match` and `forEach`.  These two functions work identically to the
 *   above, except they do not take a selector as an argument and instead
 *   use the compiled selector.
 *
 *   For cases where a complex selector is repeatedly used, this method
 *   should be faster as it will avoid recompiling the selector each time.
 */
(function(exports) {

    var // localize references
    toString = Object.prototype.toString;

    function jsonParse(str) {
      try {
          if(JSON && JSON.parse){
              return JSON.parse(str);
          }
          return (new Function("return " + str))();
      } catch(e) {
        te("ijs", e.message);
      }
    }

    // emitted error codes.
    var errorCodes = {
        "bop":  "binary operator expected",
        "ee":   "expression expected",
        "epex": "closing paren expected ')'",
        "ijs":  "invalid json string",
        "mcp":  "missing closing paren",
        "mepf": "malformed expression in pseudo-function",
        "mexp": "multiple expressions not allowed",
        "mpc":  "multiple pseudo classes (:xxx) not allowed",
        "nmi":  "multiple ids not allowed",
        "pex":  "opening paren expected '('",
        "se":   "selector expected",
        "sex":  "string expected",
        "sra":  "string required after '.'",
        "uc":   "unrecognized char",
        "ucp":  "unexpected closing paren",
        "ujs":  "unclosed json string",
        "upc":  "unrecognized pseudo class"
    };

    // throw an error message
    function te(ec, context) {
      throw new Error(errorCodes[ec] + ( context && " in '" + context + "'"));
    }

    // THE LEXER
    var toks = {
        psc: 1, // pseudo class
        psf: 2, // pseudo class function
        typ: 3, // type
        str: 4, // string
        ide: 5  // identifiers (or "classes", stuff after a dot)
    };

    // The primary lexing regular expression in jsonselect
    var pat = new RegExp(
        "^(?:" +
        // (1) whitespace
        "([\\r\\n\\t\\ ]+)|" +
        // (2) one-char ops
        "([~*,>\\)\\(])|" +
        // (3) types names
        "(string|boolean|null|array|object|number)|" +
        // (4) pseudo classes
        "(:(?:root|first-child|last-child|only-child))|" +
        // (5) pseudo functions
        "(:(?:nth-child|nth-last-child|has|expr|val|contains))|" +
        // (6) bogusly named pseudo something or others
        "(:\\w+)|" +
        // (7 & 8) identifiers and JSON strings
        "(?:(\\.)?(\\\"(?:[^\\\\\\\"]|\\\\[^\\\"])*\\\"))|" +
        // (8) bogus JSON strings missing a trailing quote
        "(\\\")|" +
        // (9) identifiers (unquoted)
        "\\.((?:[_a-zA-Z]|[^\\0-\\0177]|\\\\[^\\r\\n\\f0-9a-fA-F])(?:[\\$_a-zA-Z0-9\\-]|[^\\u0000-\\u0177]|(?:\\\\[^\\r\\n\\f0-9a-fA-F]))*)" +
        ")"
    );

    // A regular expression for matching "nth expressions" (see grammar, what :nth-child() eats)
    var nthPat = /^\s*\(\s*(?:([+\-]?)([0-9]*)n\s*(?:([+\-])\s*([0-9]))?|(odd|even)|([+\-]?[0-9]+))\s*\)/;
    function lex(str, off) {
        if (!off) off = 0;
        var m = pat.exec(str.substr(off));
        if (!m) return undefined;
        off+=m[0].length;
        var a;
        if (m[1]) a = [off, " "];
        else if (m[2]) a = [off, m[0]];
        else if (m[3]) a = [off, toks.typ, m[0]];
        else if (m[4]) a = [off, toks.psc, m[0]];
        else if (m[5]) a = [off, toks.psf, m[0]];
        else if (m[6]) te("upc", str);
        else if (m[8]) a = [off, m[7] ? toks.ide : toks.str, jsonParse(m[8])];
        else if (m[9]) te("ujs", str);
        else if (m[10]) a = [off, toks.ide, m[10].replace(/\\([^\r\n\f0-9a-fA-F])/g,"$1")];
        return a;
    }

    // THE EXPRESSION SUBSYSTEM

    var exprPat = new RegExp(
            // skip and don't capture leading whitespace
            "^\\s*(?:" +
            // (1) simple vals
            "(true|false|null)|" +
            // (2) numbers
            "(-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)|" +
            // (3) strings
            "(\"(?:[^\\]|\\[^\"])*\")|" +
            // (4) the 'x' value placeholder
            "(x)|" +
            // (5) binops
            "(&&|\\|\\||[\\$\\^<>!\\*]=|[=+\\-*/%<>])|" +
            // (6) parens
            "([\\(\\)])" +
            ")"
    );

    function is(o, t) { return typeof o === t; }
    var operators = {
        '*':  [ 9, function(lhs, rhs) { return lhs * rhs; } ],
        '/':  [ 9, function(lhs, rhs) { return lhs / rhs; } ],
        '%':  [ 9, function(lhs, rhs) { return lhs % rhs; } ],
        '+':  [ 7, function(lhs, rhs) { return lhs + rhs; } ],
        '-':  [ 7, function(lhs, rhs) { return lhs - rhs; } ],
        '<=': [ 5, function(lhs, rhs) { return is(lhs, 'number') && is(rhs, 'number') && lhs <= rhs || is(lhs, 'string') && is(rhs, 'string') && lhs <= rhs; } ],
        '>=': [ 5, function(lhs, rhs) { return is(lhs, 'number') && is(rhs, 'number') && lhs >= rhs || is(lhs, 'string') && is(rhs, 'string') && lhs >= rhs; } ],
        '$=': [ 5, function(lhs, rhs) { return is(lhs, 'string') && is(rhs, 'string') && lhs.lastIndexOf(rhs) === lhs.length - rhs.length; } ],
        '^=': [ 5, function(lhs, rhs) { return is(lhs, 'string') && is(rhs, 'string') && lhs.indexOf(rhs) === 0; } ],
        '*=': [ 5, function(lhs, rhs) { return is(lhs, 'string') && is(rhs, 'string') && lhs.indexOf(rhs) !== -1; } ],
        '>':  [ 5, function(lhs, rhs) { return is(lhs, 'number') && is(rhs, 'number') && lhs > rhs || is(lhs, 'string') && is(rhs, 'string') && lhs > rhs; } ],
        '<':  [ 5, function(lhs, rhs) { return is(lhs, 'number') && is(rhs, 'number') && lhs < rhs || is(lhs, 'string') && is(rhs, 'string') && lhs < rhs; } ],
        '=':  [ 3, function(lhs, rhs) { return lhs === rhs; } ],
        '!=': [ 3, function(lhs, rhs) { return lhs !== rhs; } ],
        '&&': [ 2, function(lhs, rhs) { return lhs && rhs; } ],
        '||': [ 1, function(lhs, rhs) { return lhs || rhs; } ]
    };

    function exprLex(str, off) {
        var v, m = exprPat.exec(str.substr(off));
        if (m) {
            off += m[0].length;
            v = m[1] || m[2] || m[3] || m[5] || m[6];
            if (m[1] || m[2] || m[3]) return [off, 0, jsonParse(v)];
            else if (m[4]) return [off, 0, undefined];
            return [off, v];
        }
    }

    function exprParse2(str, off) {
        if (!off) off = 0;
        // first we expect a value or a '('
        var l = exprLex(str, off),
            lhs;
        if (l && l[1] === '(') {
            lhs = exprParse2(str, l[0]);
            var p = exprLex(str, lhs[0]);
            if (!p || p[1] !== ')') te('epex', str);
            off = p[0];
            lhs = [ '(', lhs[1] ];
        } else if (!l || (l[1] && l[1] != 'x')) {
            te("ee", str + " - " + ( l[1] && l[1] ));
        } else {
            lhs = ((l[1] === 'x') ? undefined : l[2]);
            off = l[0];
        }

        // now we expect a binary operator or a ')'
        var op = exprLex(str, off);
        if (!op || op[1] == ')') return [off, lhs];
        else if (op[1] == 'x' || !op[1]) {
            te('bop', str + " - " + ( op[1] && op[1] ));
        }

        // tail recursion to fetch the rhs expression
        var rhs = exprParse2(str, op[0]);
        off = rhs[0];
        rhs = rhs[1];

        // and now precedence!  how shall we put everything together?
        var v;
        if (typeof rhs !== 'object' || rhs[0] === '(' || operators[op[1]][0] < operators[rhs[1]][0] ) {
            v = [lhs, op[1], rhs];
        }
        else {
            v = rhs;
            while (typeof rhs[0] === 'object' && rhs[0][0] != '(' && operators[op[1]][0] >= operators[rhs[0][1]][0]) {
                rhs = rhs[0];
            }
            rhs[0] = [lhs, op[1], rhs[0]];
        }
        return [off, v];
    }

    function exprParse(str, off) {
        function deparen(v) {
            if (typeof v !== 'object' || v === null) return v;
            else if (v[0] === '(') return deparen(v[1]);
            else return [deparen(v[0]), v[1], deparen(v[2])];
        }
        var e = exprParse2(str, off ? off : 0);
        return [e[0], deparen(e[1])];
    }

    function exprEval(expr, x) {
        if (expr === undefined) return x;
        else if (expr === null || typeof expr !== 'object') {
            return expr;
        }
        var lhs = exprEval(expr[0], x),
            rhs = exprEval(expr[2], x);
        return operators[expr[1]][1](lhs, rhs);
    }

    // THE PARSER

    function parse(str, off, nested, hints) {
        if (!nested) hints = {};

        var a = [], am, readParen;
        if (!off) off = 0;

        while (true) {
            var s = parse_selector(str, off, hints);
            a.push(s[1]);
            s = lex(str, off = s[0]);
            if (s && s[1] === " ") s = lex(str, off = s[0]);
            if (!s) break;
            // now we've parsed a selector, and have something else...
            if (s[1] === ">" || s[1] === "~") {
                if (s[1] === "~") hints.usesSiblingOp = true;
                a.push(s[1]);
                off = s[0];
            } else if (s[1] === ",") {
                if (am === undefined) am = [ ",", a ];
                else am.push(a);
                a = [];
                off = s[0];
            } else if (s[1] === ")") {
                if (!nested) te("ucp", s[1]);
                readParen = 1;
                off = s[0];
                break;
            }
        }
        if (nested && !readParen) te("mcp", str);
        if (am) am.push(a);
        var rv;
        if (!nested && hints.usesSiblingOp) {
            rv = normalize(am ? am : a);
        } else {
            rv = am ? am : a;
        }
        return [off, rv];
    }

    function normalizeOne(sel) {
        var sels = [], s;
        for (var i = 0; i < sel.length; i++) {
            if (sel[i] === '~') {
                // `A ~ B` maps to `:has(:root > A) > B`
                // `Z A ~ B` maps to `Z :has(:root > A) > B, Z:has(:root > A) > B`
                // This first clause, takes care of the first case, and the first half of the latter case.
                if (i < 2 || sel[i-2] != '>') {
                    s = sel.slice(0,i-1);
                    s = s.concat([{has:[[{pc: ":root"}, ">", sel[i-1]]]}, ">"]);
                    s = s.concat(sel.slice(i+1));
                    sels.push(s);
                }
                // here we take care of the second half of above:
                // (`Z A ~ B` maps to `Z :has(:root > A) > B, Z :has(:root > A) > B`)
                // and a new case:
                // Z > A ~ B maps to Z:has(:root > A) > B
                if (i > 1) {
                    var at = sel[i-2] === '>' ? i-3 : i-2;
                    s = sel.slice(0,at);
                    var z = {};
                    for (var k in sel[at]) if (sel[at].hasOwnProperty(k)) z[k] = sel[at][k];
                    if (!z.has) z.has = [];
                    z.has.push([{pc: ":root"}, ">", sel[i-1]]);
                    s = s.concat(z, '>', sel.slice(i+1));
                    sels.push(s);
                }
                break;
            }
        }
        if (i == sel.length) return sel;
        return sels.length > 1 ? [','].concat(sels) : sels[0];
    }

    function normalize(sels) {
        if (sels[0] === ',') {
            var r = [","];
            for (var i = i; i < sels.length; i++) {
                var s = normalizeOne(s[i]);
                r = r.concat(s[0] === "," ? s.slice(1) : s);
            }
            return r;
        } else {
            return normalizeOne(sels);
        }
    }

    function parse_selector(str, off, hints) {
        var soff = off;
        var s = { };
        var l = lex(str, off);
        // skip space
        if (l && l[1] === " ") { soff = off = l[0]; l = lex(str, off); }
        if (l && l[1] === toks.typ) {
            s.type = l[2];
            l = lex(str, (off = l[0]));
        } else if (l && l[1] === "*") {
            // don't bother representing the universal sel, '*' in the
            // parse tree, cause it's the default
            l = lex(str, (off = l[0]));
        }

        // now support either an id or a pc
        while (true) {
            if (l === undefined) {
                break;
            } else if (l[1] === toks.ide) {
                if (s.id) te("nmi", l[1]);
                s.id = l[2];
            } else if (l[1] === toks.psc) {
                if (s.pc || s.pf) te("mpc", l[1]);
                // collapse first-child and last-child into nth-child expressions
                if (l[2] === ":first-child") {
                    s.pf = ":nth-child";
                    s.a = 0;
                    s.b = 1;
                } else if (l[2] === ":last-child") {
                    s.pf = ":nth-last-child";
                    s.a = 0;
                    s.b = 1;
                } else {
                    s.pc = l[2];
                }
            } else if (l[1] === toks.psf) {
                if (l[2] === ":val" || l[2] === ":contains") {
                    s.expr = [ undefined, l[2] === ":val" ? "=" : "*=", undefined];
                    // any amount of whitespace, followed by paren, string, paren
                    l = lex(str, (off = l[0]));
                    if (l && l[1] === " ") l = lex(str, off = l[0]);
                    if (!l || l[1] !== "(") te("pex", str);
                    l = lex(str, (off = l[0]));
                    if (l && l[1] === " ") l = lex(str, off = l[0]);
                    if (!l || l[1] !== toks.str) te("sex", str);
                    s.expr[2] = l[2];
                    l = lex(str, (off = l[0]));
                    if (l && l[1] === " ") l = lex(str, off = l[0]);
                    if (!l || l[1] !== ")") te("epex", str);
                } else if (l[2] === ":has") {
                    // any amount of whitespace, followed by paren
                    l = lex(str, (off = l[0]));
                    if (l && l[1] === " ") l = lex(str, off = l[0]);
                    if (!l || l[1] !== "(") te("pex", str);
                    var h = parse(str, l[0], true);
                    l[0] = h[0];
                    if (!s.has) s.has = [];
                    s.has.push(h[1]);
                } else if (l[2] === ":expr") {
                    if (s.expr) te("mexp", str);
                    var e = exprParse(str, l[0]);
                    l[0] = e[0];
                    s.expr = e[1];
                } else {
                    if (s.pc || s.pf ) te("mpc", str);
                    s.pf = l[2];
                    var m = nthPat.exec(str.substr(l[0]));
                    if (!m) te("mepf", str);
                    if (m[5]) {
                        s.a = 2;
                        s.b = (m[5] === "odd") ? 1 : 0;
                    } else if (m[6]) {
                        s.a = 0;
                        s.b = parseInt(m[6], 10);
                    } else {
                        s.a = parseInt((m[1] ? m[1] : "+") + (m[2] ? m[2] : "1"),10);
                        s.b = m[3] ? parseInt(m[3] + m[4],10) : 0;
                    }
                    l[0] += m[0].length;
                }
            } else {
                break;
            }
            l = lex(str, (off = l[0]));
        }

        // now if we didn't actually parse anything it's an error
        if (soff === off) te("se", str);

        return [off, s];
    }

    // THE EVALUATOR

    function isArray(o) {
        return Array.isArray ? Array.isArray(o) : 
          toString.call(o) === "[object Array]";
    }

    function mytypeof(o) {
        if (o === null) return "null";
        var to = typeof o;
        if (to === "object" && isArray(o)) to = "array";
        return to;
    }

    function mn(node, sel, id, num, tot) {
        var sels = [];
        var cs = (sel[0] === ">") ? sel[1] : sel[0];
        var m = true, mod;
        if (cs.type) m = m && (cs.type === mytypeof(node));
        if (cs.id)   m = m && (cs.id === id);
        if (m && cs.pf) {
            if (cs.pf === ":nth-last-child") num = tot - num;
            else num++;
            if (cs.a === 0) {
                m = cs.b === num;
            } else {
                mod = ((num - cs.b) % cs.a);

                m = (!mod && ((num*cs.a + cs.b) >= 0));
            }
        }
        if (m && cs.has) {
            // perhaps we should augment forEach to handle a return value
            // that indicates "client cancels traversal"?
            var bail = function() { throw 42; };
            for (var i = 0; i < cs.has.length; i++) {
                try {
                    forEach(cs.has[i], node, bail);
                } catch (e) {
                    if (e === 42) continue;
                }
                m = false;
                break;
            }
        }
        if (m && cs.expr) {
            m = exprEval(cs.expr, node);
        }
        // should we repeat this selector for descendants?
        if (sel[0] !== ">" && sel[0].pc !== ":root") sels.push(sel);

        if (m) {
            // is there a fragment that we should pass down?
            if (sel[0] === ">") { if (sel.length > 2) { m = false; sels.push(sel.slice(2)); } }
            else if (sel.length > 1) { m = false; sels.push(sel.slice(1)); }
        }

        return [m, sels];
    }

    function forEach(sel, obj, fun, id, num, tot) {
        var a = (sel[0] === ",") ? sel.slice(1) : [sel],
        a0 = [],
        call = false,
        i = 0, j = 0, k, x;
        for (i = 0; i < a.length; i++) {
            x = mn(obj, a[i], id, num, tot);
            if (x[0]) {
                call = true;
            }
            for (j = 0; j < x[1].length; j++) {
                a0.push(x[1][j]);
            }
        }
        if (a0.length && typeof obj === "object") {
            if (a0.length >= 1) {
                a0.unshift(",");
            }
            if (isArray(obj)) {
                for (i = 0; i < obj.length; i++) {
                    forEach(a0, obj[i], fun, undefined, i, obj.length);
                }
            } else {
                for (k in obj) {
                    if (obj.hasOwnProperty(k)) {
                        forEach(a0, obj[k], fun, k);
                    }
                }
            }
        }
        if (call && fun) {
            fun(obj);
        }
    }

    function match(sel, obj) {
        var a = [];
        forEach(sel, obj, function(x) {
            a.push(x);
        });
        return a;
    }

    function format(sel, arr) {
        sel = sel.replace(/\?/g, function() {
            if (arr.length === 0) throw "too few parameters given";
            var p = arr.shift();
            return ((typeof p === 'string') ? JSON.stringify(p) : p);
        });
        if (arr.length) throw "too many parameters supplied";
        return sel;
    }

    function compile(sel, arr) {
        if (arr) sel = format(sel, arr);
        return {
            sel: parse(sel)[1],
            match: function(obj){
                return match(this.sel, obj);
            },
            forEach: function(obj, fun) {
                return forEach(this.sel, obj, fun);
            }
        };
    }

    exports._lex = lex;
    exports._parse = parse;
    exports.match = function (sel, arr, obj) {
        if (!obj) { obj = arr; arr = undefined; }
        return compile(sel, arr).match(obj);
    };
    exports.forEach = function(sel, arr, obj, fun) {
        if (!fun) { fun = obj;  obj = arr; arr = undefined; }
        return compile(sel, arr).forEach(obj, fun);
    };
    exports.compile = compile;
})(typeof exports === "undefined" ? (window.JSONSelect = {}) : exports);
/** global sprat namespace */
var sprat = sprat || {};

/** global sprat instance */
sprat.$spratAppInstance = sprat.$spratAppInstance || null;

/**
 * Assert that a valid sprat.$spratAppInstance is available
 * @throws If sprat.$spratAppInstance is undefined
 * @return {boolean}
 */
function requireSpratAppInitialized() {
	if (!sprat.$spratAppInstance) {
		throw "No running sprat.$spratAppInstance. Have you called new sprat.app().initialize() ?";
	}
	
	return true;
}

/**
 * Create a new sprat application instance
 * @param {object} config configuration data
 * @return
 */
sprat.app = function(config) {
	var self = this;
	
	// validate parameters
	(function validate(config) {
		if (!config) {
			throw "You must provide a configuration object for your Sprat application";
		}
		
		if (!config.flavor) {
			throw "You must provide a 'flavor' attribute for your application configuration";
		}
		
		if ($.inArray(config.flavor, ["spring", "laravel"]) < 0) {
			throw "Only 'spring' or 'laravel' allowed as flavor";
		}
		
		// valid configure() attribute?
		if (config.configure) {
			if (!jQuery.isFunction(config.configure)) {
				throw "Attribute 'configure' must be a callback function";
			}

			self.configure = config.configure;
		}

		self.config = config;
		// link this instance to global variable
		sprat.$spratAppInstance = self;
	})(config);
	
	// default callback
	self.configure = function() {
	};
	
	self.initialize = function() {
		if (config.configure) {
			config.configure();
		}
	};
	
	/**
	 * execute callback on $(document).ready() state
	 */
	self.run = function(callback) {
		$(document).ready(callback);
	};
	
	self.flavor = function() {
		return self.config.flavor;
	};
	
	self.debug = function() {
		return self.config.debug;
	};
};
var sprat = sprat || {};

/**
 * sprat.path is a simple utility to resolve template paths for REST collections
 * and resources. Use <code>
 * var user_resource = new
 * sprat.path()
 * 	.resourceAt('/user/{0}')
 * 		.add('index')
 * 		.add('details', '/detail')
 * 		.finish()
 * 	.collectionAt('/users')
 * 		.add('index')
 * 		.finish()
 * </code>
 * to create a new path resource for user objects. You can access the details
 * path for the user id '555' by calling <code>
 * user_resource.resource(555).details(); // returns '/user/555/detail'
 * </code>
 * 
 * sprat.path.test.js contains QUnit tests with more examples.
 */
sprat.path = function() {
	var self = {};

	/**
	 * Mapping functions. The mapping functions contains an object per function
	 * alias
	 */
	var mappings = {
		resource : {},
		collection : {}
	};

	/**
	 * Accessors are only used to map the function calls to the mappings array
	 */
	var accessors = {
		resource : null,
		collection : null
	};

	var util = {
		/**
		 * Creates a fluent interface for adding new URI mappings to the context
		 * 
		 * @param {object} mapping
		 *            object/hashmap containing the mapping between an alias and
		 *            the URI mapper object
		 * @param {object} aliasFunction
		 *            object/hashmap containing the alias as a function so you
		 *            can call the alias 'my_alias' as my_alias().
		 * @return fluent interface
		 */
		createFluentInterface : function(mapping, aliasFunctions) {
			var _self = {};
			_self.mapping = mapping;
			_self.aliasFunctions = aliasFunctions;

			/**
			 * Add a new alias to the aliased functions object and register the
			 * function handler
			 * 
			 * @param {string} alias
			 *            alias of the path
			 * @param {{string|function}}
			 *            if parameter is a string, it will be appended to the
			 *            root string. If it is a function, the function is used
			 *            to return the full resource path.
			 * @throw exception if argument length is 0
			 */
			_self.add = function() {
				if (arguments.length === 0) {
					throw "Expected at least an alias when adding a resource or a collection";
				}

				var alias = arguments[0];
				var append = '';
				var _templatePathTranslator = null;

				// second parameter: string|function
				if (arguments.length > 1) {
					if (typeof (arguments[1]) === 'string') {
						append = arguments[1];
					} else if (typeof (arguments[1]) === 'function') {
						_templatePathTranslator = arguments[1];
					}
				}
				
				if (append && /^\w/.test(append)) {
					append = "/" + append;
				}

				// if user has not provided own function to translate the
				// template path, we use the default handler
				_templatePathTranslator = _templatePathTranslator || function(state) {
					return self.parsePathTemplate(state.root + append, state.lastArguments);
				};

				if (_self.aliasFunctions[alias]) {
					throw "Alias '" + alias + "' is already defined";
				}

				_self.mapping[alias] = {
					uri : _templatePathTranslator,
					renderer : function() {
						throw "Renderer not defined";
					},
					context : {}
				};

				// register the forwarded alias function. By adding an alias
				// 'my_alias' the method my_alias() is registered and callable
				_self.aliasFunctions[alias] = function() {
					// push arguments from my_alias(..args..) to the last
					// argument handler
					util.pushArguments(this.__internal.lastArguments, arguments);
					// call the mapping function to create the internal URI
					return _self.mapping[alias].uri(this.__internal);
				};

				return _self;
			};

			/**
			 * Fluent interface sugar. Return the original object
			 * 
			 * @return {object} sprat.path
			 */
			_self.finish = function() {
				return self;
			};

			return _self;
		},
		/**
		 * Create a new proxy function for .resource(... args...) or
		 * .collection(). With every call the arguments of .resource() and
		 * .collection() are passed to the alias function. Returns the alias
		 * function.
		 * 
		 * @param {object} aliasFunction holds all aliases added later with .add(...)
		 * @return {object}
		 */
		initializeAccessor : function(aliasFunctions) {
			var _self = {};
			_self.aliasFunctions = aliasFunctions;

			return function() {
				// this is a little bit tricky. As this is a inner function we
				// can not use "arguments" to access the function parameter.
				// Instead, we have to use *this* to access its arguments.
				//
				// The last arguments are resetted to the current arguments
				_self.aliasFunctions.__internal.lastArguments = this;
				// return all aliases as callable function
				return _self.aliasFunctions;
			};
		},
		/**
		 * Create a default object structure for storing the function aliases
		 * 
		 * @param {string} root
		 */
		createAliasFunctionHolder : function(root) {
			var aliasFunctions = {
				/**
				 * Internal data
				 */
				__internal : {
					'root' : root,
					/**
					 * Contains the arguments from .resource()/.collections and
					 * $alias(...arguments...)
					 */
					lastArguments : []
				}
			};

			return aliasFunctions;
		},
		/**
		 * Pushes every argument element to the array
		 * 
		 * @param {array} array
		 *            an initialized array
		 * @param {array} args function arguments
		 * @return {array} the array containing the pushed values
		 */
		pushArguments : function(array, args) {
			for (var i = 0; i < args.length; i++) {
				// use special resolver
				var value = self.resolvers.resolve(args[i]);
				array.push(value);
			}

			return array;
		}
	};

	/**
	 * Registered mappings
	 */
	self._mapppings = function() {
		return mappings;
	};

	/**
	 * Resolvers used for identifying variables inside the path template
	 */
	self.resolvers = {
		registered : [
			/**
			 * Resolver for Spring Data / HATEOS objects
			 * @param {object} data
			 */
			function(data) {
				if (data && data._links && data._links.self) {
					var s = data._links.self.href;
					// Spring Data REST: exclude templated string like
					// 123{?projection}
					var id = s.substring(s.lastIndexOf("/") + 1);
					
					if (id.indexOf("{") > 0) {
						return id.substring(0, id.indexOf("{"));
					}

					return id;
				}

				return undefined;
			},
			/**
			 * Fallback to return the data
			 * @param {object} data
			 */
			function(data) {
				return data;
			} 
		],
		/**
		 * Resolve the data
		 * @param {object} data}
		 * @return {object}
		 */
		resolve : function(data) {
			for (var i = 0; i < this.registered.length; i++) {
				var r = this.registered[i](data);

				if (r !== undefined) {
					return r;
				}
			}

			return data;
		}
	};

	/**
	 * Parse a path template and resolve every path variable by given
	 * parameters. Indexed template variables ({0}, {1}, {...}) are looked up by
	 * the passed parameter count. Template variables by name like '{name}' are
	 * resolved by iterating over every parameter and tryining to find the given
	 * key if the parameter is an object. If a default value is given
	 * ({name:my_default_value}) the default value is used if the path variable
	 * could not be resolved.
	 * 
	 * @param {string} path
	 *            The path can have a format like '/a/b/c={0}/d={1}',
	 *            '/a?{name:default_value}' or '/a?name={name}'. The template
	 *            variables can be mixed up.
	 * @param {array} parameters
	 *            a list of objects, strings or integers which are
	 *            used to populate the path variables.
	 */
	self.parsePathTemplate = function(path, parameters) {
		var matcher = /\{(\w*)(:(\w*))?\}/;

		/**
		 * Extract the value for the given identifier from the provided
		 * parameters
		 * 
		 * @param {string} identifier
		 * @param {{number|string}} _defaultValue 
		 *			value to fallback if path variable could not be found
		 * @param {array} parameters
		 * @return _defaultValue or an empty string if parameter is not present
		 */
		function valueFor(identifier, _defaultValue, parameters) {
			// identifier is an integer
			if ($.isNumeric(identifier)) {
				if (parseInt(identifier) < parameters.length) {
					return parameters[parseInt(identifier)];
				}
			}

			// find objects in parameter list and find the given key
			for (var i = 0; i < parameters.length; i++) {
				if (typeof (parameters[i]) === 'object') {
					if (parameters[i][identifier]) {
						return parameters[i][identifier];
					}
				}
			}

			return _defaultValue || "";
		}

		var matches;

		// iterate over every match to make sure we can handle '/{0}/{1}/...'
		while (null !== (matches = matcher.exec(path))) {
			var replace = matches[0];
			path = path.replace(replace, valueFor(matches[1], matches[3], parameters));
		}

		return path;
	};

	/**
	 * Provide paths for a single resource. Pass one or multiple parameters to
	 * satisfy your path variable structure.
	 * 
	 * @return
	 */
	self.resource = function() {
		// sanity check
		if (!accessors.resource) {
			throw "No resource path has been prior defined by using resourceAt(...)";
		}
		
		// call the proxy and apply all arguments from the .resource(...args..)
		return accessors.resource.apply(util.pushArguments([], arguments));
	};

	/**
	 * Create a new resource at the provided root path. Use
	 * resourceAt('/root').add('...') to add a new alias function to access the
	 * REST function.
	 * 
	 * @param {string} root
	 * @return
	 */
	self.resourceAt = function(root) {
		// initialize state of forwarded function aliases
		var aliasFunctions = util.createAliasFunctionHolder(root);
		accessors.resource = new util.initializeAccessor(aliasFunctions);
		return new util.createFluentInterface(mappings.resource, aliasFunctions);
	};

	/**
	 * Provide paths for a collection of resources. Pass one or multiple
	 * parameters to satisfy your path variable structure.
	 * 
	 * @return
	 */
	self.collection = function() {
		// sanity check
		if (!accessors.collection) {
			throw "No collection path has been prior defined by using collectionAt(...)";
		}

		// call the proxy and apply all arguments from the .collection(...args..)
		return accessors.collection.apply(util.pushArguments([], arguments));
	};

	/**
	 * Create a new collection at the provided root path. Use
	 * collectionAt('/root').add('...') to add a new alias function to access
	 * the REST function.
	 * 
	 * @param {string} root
	 * @return
	 */
	self.collectionAt = function(root) {
		var aliasFunctions = util.createAliasFunctionHolder(root);
		accessors.collection = new util.initializeAccessor(aliasFunctions);
		return new util.createFluentInterface(mappings.collection, aliasFunctions);
	};

	return self;
};
/** global sprat namespace */
var sprat = sprat || {};

sprat.security = {
	csrf: {
		/**
		 * Auto-configuration; configure Laravel or Spring Security CSRF implementation.
		 * @throw exception if sprat/app.js has not been included or app has not been initialized
		 */
		configure: function() {
			var isInitialized = requireSpratAppInitialized() || (function() { throw "sprat/app.js not included?"; })();
			
			switch (sprat.$spratAppInstance.flavor()) {
				case "laravel":
					sprat.security.csrf.configureLaravel();
					break;
				default:
					sprat.security.csrf.configureSpringSecurity();
					break;
			}
		},
		/**
		 * Configure the CSRF header needed for AJAX requests with Spring Security
		 * @throw exception if <meta name='_csrf' ... /> or <meta name='_csrf_header' ... /> has not been defined
		 */
		configureSpringSecurity: function() {
			// make AJAX working with Thymeleaf and Spring Security, see
			// http://stackoverflow.com/questions/23477344/put-csrf-into-headers-in-spring-4-0-3-spring-security-3-2-3-thymeleaf-2-1-2
			var token = $("meta[name='_csrf']").attr("content");
			var header = $("meta[name='_csrf_header']").attr("content");

			if (!token || !header) {
				throw "You must define <meta name='_csrf' /> and <meta name='_csrf_header' />, see http://stackoverflow.com/questions/23477344/put-csrf-into-headers-in-spring-4-0-3-spring-security-3-2-3-thymeleaf-2-1-2";
			}

			$(document).ajaxSend(function(e, xhr, options) {
				xhr.setRequestHeader(header, token);
			});
		},
		/**
		 * Configure the X-CSRF-TOKEN needed for AJAX requests with Laravel >= 5.1
		 * @throw exception if <meta name='_csrf' ... /> has not been defined
		 */
		configureLaravel: function() {
			// see http://laravel.com/docs/5.1/routing#csrf-x-csrf-token
			var token = $("meta[name='_csrf']").attr("content");
			
			if (!token) {
				throw "You must define <meta name='_csrf' />, see http://laravel.com/docs/5.1/routing#csrf-x-csrf-token";
			}
			
			$(document).ajaxSend(function(e, xhr, options) {
				xhr.setRequestHeader("X-CSRF-TOKEN", token);
			});
		}
	}
};
var sprat = sprat || {};

/**
 * Wrestle introspects the HTTP response after an AJAX call and executes
 * different handlers based upon the result. This makes it easy to handle
 * different response types and backends.
 */
sprat.wrestle = (function() {
	var self = {};

	self.hateoas = {
		/**
		 * Check if the resource contains the _links.self.href location
		 * 
		 * @param {object}
		 *            data
		 * @return {boolean}
		 */
		isSelfHrefAvailable : function(data) {
			return this.isValidResourceLink('self', data);
		},
		/**
		 * Check if the _links.$resourceName.href key is available
		 * 
		 * @param {string} resourceName
		 *            name of resource
		 * @param {object} data
		 *            data
		 * @return {boolean}
		 */
		isValidResourceLink : function(resourceName, data) {
			return (data && data._links && data._links[resourceName] && data._links[resourceName].href);
		},
		/**
		 * Get the link for the given resource
		 * 
		 * @param {string} resourceName
		 *            name of resource
		 * @param {object} data
		 * @throws Will throw exception if resource link is not available
		 * @return {string} resource link
		 */
		resourceLink : function(resourceName, data) {
			if (!this.isValidResourceLink(resourceName, data)) {
				throw "Resource link '" + resourceName + "' does not exist";
			}

			return data._links[resourceName].href;
		}
	};

	var util = {
		/**
		 * Is the given object an jqXHR response or not
		 * 
		 * @param {object} object
		 * @returns {boolean}
		 */
		isJqXHR : function(object) {
			return (object && object.status && object.readyState && (object.responseText !== undefined));
		},
		/**
		 * Execute every handler method of the pipe array
		 * 
		 * @param {array} pipe
		 *            array of handlers
		 * @param {object}
		 *            data
		 * @param {object}
		 *            jqXHR
		 * @param {string}
		 *            textStatus
		 * @param {object}
		 *            context
		 */
		runPipes : function(pipe, data, jqXHR, textStatus, context) {
			for (var i = 0, m = pipe.length; i < m; i++) {
				var handler = pipe[i];

				if (typeof (handler) !== 'function') {
					util.error("Expected a function but got the following element:");
					util.debug(handler);
					throw "Expected a function as pipe handler, current element at index '" + i + "' is " + handler;
				}

				var r = handler(data, jqXHR, textStatus, context);

				if (r === true) {
					util.debug("Pipe returned true, no further pipe handling");
					return;
				}
			}
		},
		/**
		 * Debug message
		 * 
		 * @param {string} msg
		 */
		debug : function(msg) {
			// by default debugging is disabled
			if (console && sprat.$spratAppInstance && sprat.$spratAppInstance.debug()) {
				console.debug(msg);
			}
		},
		/**
		 * Error message
		 * 
		 * @param {string} msg
		 */
		error : function(msg) {
			if (console) {
				console.error(msg);
			}
		},
		/**
		 * Info message
		 * 
		 * @param {string} msg
		 */
		info : function(msg) {
			if (console) {
				console.info(msg);
			}
		},
		/**
		 * Return an array, based upon the given parameter
		 * 
		 * @param {{Array|null|string}} param
		 *            parameter
		 * @return {Array} An empty array if "param" is null; an one-sized array with one element if "param" is a string or the "param" if "param" is an array
		 */
		assertArray : function(param) {
			if (param === null || param === undefined) {
				return [];
			}

			if (!$.isArray(param)) {
				return [ param ];
			}

			return param;
		}
	};

	/**
	 * Global available pipes. To add a new pipe to this array, just use
	 * sprat.wrestle.pipes.always['my_pipe'] = function() { return function() {} };
	 * Please note that your will only register factory methods which return new
	 * handlers.
	 * 
	 * If a pipe entry matches a given response, it should trigger an event to
	 * let the user decide how to handle the response.
	 */
	self.pipes = {
		/**
		 * self.pipes.always are executed directly after receiving the HTTP
		 * response. The handlers are for deciding if the response is an
		 * (unrecoverable) error or a normal response.
		 */
		always : {
			/**
			 * Thanks to jQuery > 1.9 we have to process the server response for
			 * delegating to the right handler. jQuery > 1.9 assumes that an
			 * empty response body with an OK HTTP status code is invalid and
			 * calls the "error" handler.
			 * 
			 * @return {function} new function(dataOrJqXHR, textStatus, jqXHROrErrorThrown,
			 *         context)
			 */
			successForHttpHeaderBetween200And399 : function() {
				return function(dataOrJqXHR, textStatus, jqXHROrErrorThrown, context) {
					util.debug("Running successForHttpHeaderBetween200And399 ... ");
					// argument order on fail(): jqXHR, textStatus, errorThrown
					// argument order on done(): data, textStatus, jqXHR
					var jqXHR = util.isJqXHR(dataOrJqXHR) ? dataOrJqXHR : jqXHROrErrorThrown;

					// some valid responses which can return JSON or empty
					// responses
					if (jqXHR.status >= 200 && jqXHR.status < 400) {
						console.debug("Recevied HTTP status code >= 200 && < 400, executing success pipe");

						var data = dataOrJqXHR;

						// if textStatus has "parseerror", it would mean that
						// the
						// response
						// has been flagged as error an we must extract the data
						// from the
						// error argument
						if (textStatus == "parseerror") {
							data = jQuery.parseJSON(jqXHR.responseText);
						}

						util.runPipes(context.pipes.success, data, jqXHR, textStatus, context);
						return true;
					}

					util.debug("Status code '" + jqXHR.status + "' is *not* handled by pipes.success");

					// can not handle status >= 400 or < 200
					return false;
				};
			},
			/**
			 * Check if the response is an errors and should be executed at
			 * last in your always-pipe
			 * @return {function}
			 */
			fallbackToFail : function() {
				return function(dataOrJqXHR, textStatus, jqXHROrErrorThrown, context) {
					util.debug("Running fallbackToFail ... ");

					// argument order on fail(): jqXHR, textStatus, errorThrown
					// argument order on done(): data, textStatus, jqXHR
					var jqXHR = util.isJqXHR(dataOrJqXHR) ? dataOrJqXHR : jqXHROrErrorThrown;
					var data = {};

					if (jqXHR.responseText) {
						try {
							data = jQuery.parseJSON(jqXHR.responseText);
						} catch (ex) {
							util.error("Failed to parse responseText as JSON, content '" + jqXHR.responseText + "'");
						}
					}

					util.debug("Running " + context.pipes.fail.length + " error handlers");

					util.runPipes(context.pipes.fail, data, jqXHR, textStatus, context);
				};
			},
		},
		/**
		 * Responses which are valid for the application
		 */
		success : {
			/**
			 * Assume that the HTTP header "Location" or
			 * "X-Sprat-Next-Location" is set and uses this header to do a
			 * client side redirect. This is required to prevent a) duplicate
			 * POST submits and b) messing around with Chromes handling of HTTP
			 * 302 redirects.
			 * This success handler is very specific for some internal applications and should be removed sometimes.
			 * 
			 * @return {function}
			 */
			handleRedirect : function() {
				return function(data, jqXHR) {
					util.debug("Running handleRedirect ...");
					var location = jqXHR.getResponseHeader('Location') || jqXHR.getResponseHeader('X-Sprat-Next-Location');

					if (location) {
						window.location.replace(location);
						return true;
					}
				};
			},
			/**
			 * Assume that the server responded with 204 - No Content. The
			 * event 'handleModelUpdated' is triggered.
			 * @return {function}
			 */
			handleModelUpdated : function() {
				return function(data, jqXHR, textStatus, context) {
					util.debug("Running handleModelUpdated");

					if (jqXHR.status == '204') {
						util.debug("Received HTTP 204 response, triggering handleModelUpdated event");
						$(document).trigger('handleModelUpdated', [ data, jqXHR, context ]);

						return true;
					}
				};
			},
			/**
			 * Assert that the server responds with a specific HTTP response
			 * code. Normally, this would be an HTTP 200 message.
			 * @return {function}
			 */
			expectResponseCode : function() {
				return function(data, jqXHR, textStatus, context) {
					util.debug("Running expectResponseCode");

					if (!context.expectResponseCode) {
						util.debug("no .expectResponseCode given in .context, returning");
						return false;
					}

					if (jqXHR.status == context.expectResponseCode) {
						util.debug("Received expected HTTP response code '" + context.expectResponseCode + "', triggering expectResponseCode event");
						$(document).trigger('expectResponseCode', [ data, jqXHR, context ]);

						return true;
					}
				};
			},
			/**
			 * Default handler
			 * @return {function}
			 */
			handleUserNextAction : function() {
				return function() {
				};
			}
		},
		/**
		 * Server-side failures. This could be unrecoverable application errors,
		 * validation errors or other defined errors.
		 */
		fail : {
			/**
			 * Return a new exception handler which is executed for server-side
			 * Java/Spring exceptions. The jQuery event
			 * 'springApplicationExceptionHandler' is triggered if an exception
			 * occurs. The event has the exception object as first event
			 * argument, all parameters of *this* method are passed as further
			 * parameters, 'context' is the first. All other queued pipe entries
			 * are discarded.
			 * 
			 * @return {function(data, jqXHR, textStatus, errorThrown, context)}
			 */
			springApplicationExceptionHandler : function() {
				return function(data, jqXHR, textStatus, errorThrown, context) {
					// Spring REST. Ignore exceptions of type BindException as
					// these are
					// validation exceptions
					var hasException = data.cause || (data.exception && (data.exception != 'org.springframework.validation.BindException'));

					if (hasException) {
						util.debug("Triggering springApplicationExceptionHandler");
						var exception = ('object' === typeof (data)) ? data : jQuery.parseJSON(data.responseText);

						$(document).trigger('springApplicationExceptionHandler',
								[ exception, context, data, jqXHR, textStatus, errorThrown ]);

						// stop further handlers from execution
						return true;
					}
				};
			},
			/**
			 * Return a new exception handler for Spring Data REST endpoints.
			 * The event 'springRESTErrors' is triggered if an error ocurrs. The
			 * event has the error object as first event argument, all
			 * parameters of *this* method are passed as further parameters,
			 * 'context' is the first.
			 * 
			 * @return {function(data, jqXHR, textStatus, context)}
			 */
			springRESTErrors : function() {
				return function(data, jqXHR, textStatus, context) {
					var parsedData = {};
					
					try {
						parsedData = jQuery.parseJSON(jqXHR.responseText);
					} catch (ex) {
					}

					var errors = null;

					// Spring REST single error response
					if (parsedData.error) {
						util.debug("Triggering springRESTErrors ... ");

						errors = [ parsedData ];

						$(document).trigger('springRESTErrors', [ errors, context, data, jqXHR, textStatus ]);

						return true;
					}
				};
			},
			/**
			 * Parse validation errors from
			 * org.springframework.Validation. The event
			 * 'springValidationErrors' is triggered if an error ocurrs. The
			 * event has the error object as first event argument, all
			 * parameters of *this* method are passed as further parameters.
			 * 
			 * @return {function(data, jqXHR, textStatus, errorThrown, context)}
			 */
			springValidationErrors : function() {
				return function(data, jqXHR, textStatus, context) {
					var parsedData = {};

					try {
						parsedData = jQuery.parseJSON(jqXHR.responseText);
					} catch (ex) {
					}

					var errors = null;

					if (parsedData.errors && $.isArray(parsedData.errors)) {
						util.debug("Triggering springValidationErrors ... ");
						errors = parsedData.errors;

						$(document).trigger('springValidationErrors', [ errors, context, data, jqXHR, textStatus ]);

						return true;
					}
				};
			},
			/**
			 * Should be the last handler in your pipe. Something went horrible
			 * wrong.
			 * @return {function}
			 */
			unknownResponse : function() {
				return function(data, jqXHR, textStatus, context) {
					var error = "Received unrecognized response from the backend, please contact developers";

					if (console) {
						util.debug("Data of unrecognized response: ");
						util.debug(data);
						util.debug(context);
					}

					throw error;
				};
			}
		}
	};

	/**
	 * Global configuration for sprat.wrestle
	 */
	self.configuration = {
		/**
		 * These handlers are executed first after receiving the HTTP response.
		 * If you want to overwrite this method, you must return an error with
		 * newly constructed pipe entries.
		 * 
		 * @return {Array} array with handlers
		 */
		firstResponseHandlers : function() {
			return [ new self.pipes.always.successForHttpHeaderBetween200And399(),
					new self.pipes.always.fallbackToFail() ];
		},
		/**
		 * Profiles can be used for defining standard functionality for
		 * different backend APIs.
		 */
		profiles : {
			/**
			 * Add a new profile to the global configuration element
			 * 
			 * @param {string} profile name
			 * @param {object} config
			 */
			add : function(name, config) {
				// inherit default configuration
				config = $.extend(true, {
					success : [],
					fail : []
				}, config);

				self.configuration.profiles[name] = config;
			}
		},
		// custom configuration for handlers
		handlers : {

		},
		/**
		 * Default pipe entries which are executed on every response if the user
		 * has not overwritten the response handling.
		 */
		defaults : {
			success : function() {
				return [ 
							new self.pipes.success.handleRedirect(), 
							new self.pipes.success.handleModelUpdated(),
							new self.pipes.success.expectResponseCode(), 
							new self.pipes.success.handleUserNextAction() 
						];
			},
			fail : function() {
				return [ 
							new self.pipes.fail.springApplicationExceptionHandler(),
							new self.pipes.fail.springRESTErrors(), 
							new self.pipes.fail.springValidationErrors() 
						];
			}
		},
	};

	/**
	 * Based upon the provided _arguments the AJAX call for the backend is
	 * prepared. You have different possibilites to make a new API call. Please
	 * look into the unit test definitions for more information.
	 * 
	 * @param {array} _arguments
	 *            arguments for the rest call
	 * @param {string}
	 *            HTTP method
	 * @return {object} $.ajax
	 */
	self._delegateSimpleRequest = function(_arguments, method) {
		var context = {
			pipes : {
				success : undefined,
				fail : undefined
			},
			handlers : self.configuration.handlers,
			ajax : {}
		};

		var data = null;
		var providedSuccessCallbacks = null;
		var providedFailCallbacks = null;

		var idxBeginCallbacks = 1;
		var idxEndCallbacks = 3;

		if (typeof (_arguments) == 'string') {
			throw "_arguments must be an array";
		}

		if (_arguments.length === 0 || _arguments > 4) {
			throw "_toCallArguments must have [url], [url, cbSuccess()], [url, data, cbSuccess()], [url, data, options] or [url, data, cbSuccess(), options] as first argument. You gave: " + JSON.stringify(_arguments);
		}

		// addtional context options are passed as last argument
		if (_arguments.length > 2) {
			var lastArgument = _arguments[_arguments.length - 1];

			if (typeof (lastArgument) === 'object' && !jQuery.isArray(lastArgument)) {
				context = $.extend(true, context, lastArgument);

				// last callback must be before the context object
				idxEndCallbacks = _arguments.length - 2;
			}
		}

		// data is passed as second argument
		if (_arguments.length >= 2) {
			if (typeof (_arguments[1]) === 'object') {
				data = _arguments[1];

				// first callback begins at position 2 after the data argument
				idxBeginCallbacks = 2;
			}
		}

		// determine position of any callbacks
		if (idxBeginCallbacks <= _arguments.length - 1) {
			// only success callbacks has been provided
			if (idxBeginCallbacks <= idxEndCallbacks) {
				providedSuccessCallbacks = _arguments[idxBeginCallbacks];
			}

			// Addtionally, the next argument has been the end callback
			if (idxBeginCallbacks + 1 == idxEndCallbacks) {
				providedFailCallbacks = _arguments[idxEndCallbacks];
			}
		}

		// if callbacks has been provided -an empty provided callback array *is*
		// counted as provided - overwrite the defaults
		context = self.updatePipes(providedSuccessCallbacks, providedFailCallbacks, context);

		return self.call(_arguments[0], data, method, context);
	};

	/**
	 * Ensure that the given parameters are passed into the context variable.
	 * <ul>
	 * <li>User-defined callbacks have precedence</li>
	 * <li>If a profile is provided but no callback, the profile is chosen
	 * before the defaults</li>
	 * <li>If no user-defined callback or profile is provided, the default
	 * configuration is used</li>
	 * </ul>
	 * 
	 * @param {{function|array|null}}
	 *            success callbacks provided as an argument
	 * @param {{function|array|null}}
	 *            failure callback provided as an argument
	 * @param {object}
	 *            context
	 * @return {object} context
	 */
	self.updatePipes = function(success, fail, context) {
		// defaults
		context = $.extend(true, {
			pipes : {
				success : undefined,
				fail : undefined
			},
			handlers : {

			}
		}, context);

		// enable profile
		if (context.profile) {
			util.debug("Profile '" + context.profile + "' activated");

			if (!self.configuration.profiles[context.profile]) {
				throw "Requested profile '" + context.profile + "' does not exist";
			}

			context.pipes = self.configuration.profiles[context.profile];
		}

		// provided success and fail arguments superseed the profile
		// configuration
		if (success) {
			context.pipes = context.pipes || {};
			context.pipes.success = util.assertArray(success);

			if (fail) {
				context.pipes.fail = util.assertArray(fail);
			}
		}

		// if no success/fail pipes have been defined, register our own
		if (context.pipes.success === undefined) {
			context.pipes.success = self.configuration.defaults.success();
		}

		if (context.pipes.fail === undefined) {
			context.pipes.fail = self.configuration.defaults.fail();
		}

		return context;
	};

	/**
	 * Execute the given AJAX call by delegating to jQuery.ajax(). Every request
	 * is made by using application/json as Content-Type.
	 * 
	 * @param {string} _url
	 *            URL
	 * @param {object|null} _data
	 *            unserialized data, the method determines if a serialization is
	 *            required or not
	 * @param {string} _method
	 *            HTTP method
	 * @param {object} _context
	 *            context, you can overwrite $.ajax() parameter in the property
	 *            context.ajax
	 */
	self.call = function(_url, _data, _method, _context) {
		// clear current context or we will run in problems with the current
		// AJAX call state
		var self_call = {};

		if (!_method) {
			throw "HTTP method not provided";
		}

		var contextDefault = {
			method : _method,
			firstResponseHandlers : self.configuration.firstResponseHandlers(),
			ajax : {
				url : _url,
				type : _method,
				dataType : "text json",
				contentType : "application/json"
			}
		};

		// inherit defaults
		self_call.context = $.extend(true, contextDefault, _context);

		if (_data) {
			// data has not been provided by user and we don't have a GET
			// request
			if (!self_call.context.ajax.data) {
				// Data for GET must be passed by adding the values to the
				// query string
				if (_method == 'GET') {
					self_call.context.ajax.data = _data;
				} else {
					// POST, HEAD and so on must be JSONized
					self_call.context.ajax.data = JSON.stringify(_data);
				}
			}
		}

		// this procedure is required to handle the different response types.
		// @see sprat.rest.handler.always for more information.
		return $.ajax(self_call.context.ajax).always(function(a, b, c) {
			self.run(self_call.context.firstResponseHandlers, a, b, c, self_call.context);
		});
	};

	/**
	 * Execute multiple pipes. Delegates to util.runPipes
	 * 
	 * @param {Array} pipes 
	 *            array of functions
	 * @param {object}
	 *            data
	 * @param {object}
	 *            jqXHR
	 * @param {string}
	 *            textStatus
	 * @param {object}
	 *            context
	 */
	self.run = function(pipes, data, jqXHR, textStatus, context) {
		util.runPipes(pipes, data, jqXHR, textStatus, context);
	};

	return self;
})();

/**
 * Execute a GET method
 * 
 * @return {function} $.ajax
 */
$.restGet = function() {
	return sprat.wrestle._delegateSimpleRequest(arguments, "GET");
};

/**
 * Execute a POST method
 * 
 * @return {function} $.ajax
 */
$.restPost = function() {
	return sprat.wrestle._delegateSimpleRequest(arguments, "POST");
};

/**
 * Save the object passed to this function by calling $.ajax() with the provided
 * URL. It simply delegates to sprat.rest.call but prior setting the HTTP method
 * which will be PATCH if the object has an ID > 0. Otherwise it will be set to
 * POST.
 * 
 * @param {string} _url
 * @param {object} _object
 * @param {object} _context
 *            see sprat.rest.call
 * @return {function} $.ajax
 */
$.restSave = function(_url, _object, _context) {
	_context = _context || {};

	// inherit defaults
	_context.isPersisted = $.isPersisted(_object);

	_context.ajax = _context.ajax || {};
	// POST creates a new entry; PATCH updates an existing entry. PUT replaces
	// the entire record of an entry. In most cases, this is not what we wanted.
	var method = _context.isPersisted ? "PATCH" : "POST";

	return sprat.wrestle._delegateSimpleRequest([ _url, _object, _context ], method);
};

/**
 * Execute a PUT request on the given _url with the Content-Type
 * "text/uri-list". Use this for update one-to-one or one-to-many references.
 * 
 * @param {string} _url
 * @param {{string|Array}} _references
 *            string or an array of string
 * @param {object} _context
 * @return {function} $.ajax
 */
$.restAssociationSave = function(_url, _references, _context) {
	if (!$.isArray(_references)) {
		_references = [ _references ];
	}

	var context = {
		ajax : {
			contentType : "text/uri-list",
			data : _references.join("\r\n")
		}
	};

	var useContext = $.extend(true, _context, context);
	return sprat.wrestle._delegateSimpleRequest([ _url, null, useContext ], "PUT");
};

/**
 * Update an existing resource.
 * 
 * @param {object} _object
 *            an already-persisted object containing _links.self.href to
 *            locate the backend URL
 * @param {object} _assocs
 *            hashmap: key is the name of the referenced resource
 *            provided in _object._links.$key.href, value is an string or array
 *            with values
 * @param {function} _callback
 *            function to execute after all requests have been done. All results
 *            of the REST call are forwarded to the _callback function. The
 *            first argument is the entity persist call, the association calls
 *            follows.
 * @param {object} [_context]
 *            additional _context parameter. If not explicitly defined,
 *            the _context.pipes.success is set to an empty array so that no
 *            default pipe handlers are executed.
 * @throws exception
 *             if _links.self.href is missing
 * @throws execption
 *             if of one the _assocs has no valid _links.$assocName.href value
 */
$.hateoasUpdate = function(_object, _assocs, _callback, _context) {
	if (!sprat.wrestle.hateoas.isSelfHrefAvailable(_object)) {
		throw "Missing _links.self.href section";
	}

	var resourceAssocs = {};

	for (var resourceName in _assocs) {
		resourceAssocs[sprat.wrestle.hateoas.resourceLink(resourceName, _object)] = _assocs[resourceName];
	}

	_context = _context || {};

	// disable success pipes so that the _callback is executed only
	if (!_context.pipes) {
		_context.pipes = [];
	}

	if (!_context.pipes.success) {
		_context.pipes.success = [];
	}

	var arrMethods = [];

	// persist parent entity
	arrMethods.push($.restSave(sprat.wrestle.hateoas.resourceLink('self', _object), _object, _context));

	// persist associations
	for (var resourceLink in resourceAssocs) {
		arrMethods.push($.restAssociationSave(resourceLink, resourceAssocs[resourceLink], _context));
	}

	// after *all* REST calls have been executed, the _callback is executed.
	// Every parameter of the _callback function is an array containing the AJAX
	// result. In case of success, the third index ([2]) contains the $.ajax
	// context.
	$.when.apply($, arrMethods).then(_callback);
};

/**
 * Check the persistence state of the given object. if _object._links.self.href
 * or _object.id is defined it is assumed that the object is already persisted.
 * 
 * @param {object} _object
 * @return {boolean}
 */
$.isPersisted = function(_object) {
	if (!_object) {
		throw "no object given";
	}

	if (_object._links && _object._links.self.href) {
		return true;
	}

	return (_object.id && _object.id > 0);
};
/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};

/**
 * See
 * http://stackoverflow.com/questions/6491463/accessing-nested-javascript-objects-with-string-key
 * 
 * @param {object} o
 * @param {string} s
 * @returns {object}
 */
Object.byString = function(o, s) {
	s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
	s = s.replace(/^\./, ''); // strip a leading dot
	var a = s.split('.');
	while (a.length) {
		var n = a.shift();
		if (n in o) {
			o = o[n];
		} else {
			return;
		}
	}
	return o;
};

sprat.ui = {
	/**
	 * Enable a modal dialog in the UI. The method uses Twitter Bootstrap
	 * classes and the modal() extension of Bootstrap. _options:
	 * 
	 * <pre>
	 * {
	 * 	.title: string, replaces .modal-title,
	 *  .body: string, replaces .modal-body,
	 *  .footer: string, replaces .modal-footer; if null, the footer is disabled,
	 *  .closeable: boolean, enable or disable Close button and footer,
	 *  .root: string, jQuery selector which contains the modal #modal layer|default: &quot;#modal&quot;
	 *  }
	 * </pre>
	 */
	modal : function(_options) {
		var defaults = {
			title : "Kein Titel",
			body : "Kein Text",
			footer : '<button type="button" class="btn btn-default" data-dismiss="modal">Schließen</button>',
			closeable : true,
			root : "#modal"
		};

		var options = $.extend(true, defaults, _options);

		var modal = $(options.root);

		modal.find(".modal-body").html(options.body);
		modal.find(".modal-title").html(options.title);

		var args = "show";

		if (options.closeable) {
			modal.find(".modal-footer").html(options.footer);
		} else {
			modal.find(".modal-header .close").hide();
			modal.find(".modal-footer").hide();
			args = {
				keyboard : false
			};
		}

		$(options.root).modal(args);
	},
	/**
	 * Find the root element for further jQuery selections. By default, the root
	 * context "body" will be returned
	 * 
	 * @param {object} options
	 *            if options has property .formContext, this will be used as
	 *            root
	 * @param {string} [selector]
	 *            If the optional selector is specified, the prior root context (body or
	 *            .formContext) will be used
	 */
	findRoot : function(options, selector) {
		var root = $("body");

		if (options && options.form) {
			root = options.form;
		}

		// check for valid root
		if (!(root instanceof jQuery)) {
			throw "The root you provided is not a jQuery object. Pass { form: $('my_selector') to options array }";
		}

		if (selector) {
			var appender = root.find(selector);

			if (appender.length >= 1) {
				root = $(appender[0]);
			}
		}

		return root;
	}
};