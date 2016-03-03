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
sprat.app = function (config) {
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
    self.configure = function () {
    };

    self.initialize = function () {
        if (config.configure) {
            config.configure();
        }
    };

    /**
     * execute callback on $(document).ready() state
     */
    self.run = function (callback) {
        $(document).ready(callback);
    };

    self.flavor = function () {
        return self.config.flavor;
    };

    self.debug = function() {
        return self.config.debug;
    };
};

var sprat = sprat || {};
var $ = $ || {};

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
		 * @param object
		 *            object/hashmap containing the mapping between an alias and
		 *            the URI mapper object
		 * @param object
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
			 * @param string
			 *            alias of the path
			 * @param string|function
			 *            if parameter is a string, it will be appended to the
			 *            root string. If it is a function, the function is used
			 *            to return the full resource path.
			 */
			_self.add = function(alias) {
				if (arguments.length === 0) {
					throw "Expected at least an alias when adding a resource or a collection";
				}

				alias = arguments[0];
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
					return sprat.web.uri.parse(state.root + append, state.lastArguments);
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
			 * @return object sprat.path
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
		 * @param object
		 *            aliasFunction holds all aliases added later with .add(...)
		 * @return object
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
		 * @param string
		 *            root
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
		 * @param array
		 *            an initialized array
		 * @param arguments
		 *            function arguments
		 * @return the array containing the pushed values
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
		 */
		function(data) {
			/*jshint -W069 */
			if (data && data["_links"] && data._links["self"]) {
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
		 */
		function(data) {
			return data;
		} ],
		/**
		 * Resolve the data
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
	 * @param string
	 *            root
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
	 * @param string
	 *            root
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
        configure: function () {
            var isInitialized = requireSpratAppInitialized() || (function () {
                    throw "sprat/app.js not included?";
                })();

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
        configureSpringSecurity: function () {
            // make AJAX working with Thymeleaf and Spring Security, see
            // http://stackoverflow.com/questions/23477344/put-csrf-into-headers-in-spring-4-0-3-spring-security-3-2-3-thymeleaf-2-1-2
            var token = $("meta[name='_csrf']").attr("content");
            var header = $("meta[name='_csrf_header']").attr("content");

            if (!token || !header) {
                throw "You must define <meta name='_csrf' /> and <meta name='_csrf_header' />, see http://stackoverflow.com/questions/23477344/put-csrf-into-headers-in-spring-4-0-3-spring-security-3-2-3-thymeleaf-2-1-2";
            }

            $(document).ajaxSend(function (e, xhr, options) {
                xhr.setRequestHeader(header, token);
            });
        },
        /**
         * Configure the X-CSRF-TOKEN needed for AJAX requests with Laravel >= 5.1
         * @throw exception if <meta name='_csrf' ... /> has not been defined
         */
        configureLaravel: function () {
            // see http://laravel.com/docs/5.1/routing#csrf-x-csrf-token
            var token = $("meta[name='_csrf']").attr("content");

            if (!token) {
                throw "You must define <meta name='_csrf' />, see http://laravel.com/docs/5.1/routing#csrf-x-csrf-token";
            }

            $(document).ajaxSend(function (e, xhr, options) {
                xhr.setRequestHeader("X-CSRF-TOKEN", token);
            });
        }
    }
};
/** global sprat namespace */
var sprat = sprat || {};

sprat.uri = sprat.uri || {};

/**
 * This package stores URI actions on an abstract level
 * 
 * @param _root
 *            Root URI for this action
 * @param _defaults
 *            a key/value object, where key is the alias and value is a string
 *            (a subaction of the _root), a callback function or an object.
 * @returns {sprat.uri.actionMapper}
 */
sprat.uri.actionMapper = function(_root, _defaults) {
	var self = this;

	// root URI, will be appended to the URI fo the collection or resource
	self.root = _root;

	/**
	 * Register a new alias for given endpoint
	 * 
	 * @param data
	 *            A string, a function or an object.
	 */
	self.register = function(name, data) {
		self.registered[name] = data;
	};

	// arguments pushed to the URI action
	self.arguments = [];

	// registered actions
	self.registered = {};

	/**
	 * Return the URI part, a callback function or a custom object
	 * 
	 * @param alias
	 *            alias of action; if undefined an empty sub action will be
	 *            returned
	 * @return object
	 * @throws if
	 *             alias is not registered
	 */
	self.data = function(alias) {
		if (!alias) {
			return "";
		}

		var obj = self.registered[alias];

		if (obj === undefined) {
			throw "There is no URI mapping for alias '" + alias + "'";
		}

		return obj;
	};

	/**
	 * If the data behind the given alias is a simple string, the string will be
	 * converted to a full/relative URI. If underlying data is an object, the
	 * property "uri" is used for creating the URI. If underlying data is a
	 * function, the function is called and their return value will returned to
	 * the caller of this function
	 * 
	 * @param alias
	 *            alias to lookup
	 * @return string full URI
	 */
	self.uri = function(alias) {
		obj = self.data(alias);

		// if an object has been provided, the user should define the property
		// "uri". Otherwise, no sub action will be appoended
		if ("object" === typeof (obj)) {
			/*jshint -W069 */
			if (!obj["uri"]) {
				obj = "";
			}
		}

		// arguments for the URI generation
		var args = $.merge([ self.root ], self.arguments);

		if ("function" === typeof (obj)) {
			// execute callback function with arguments and alias as last
			// parameter
			return obj.apply($.merge(args, [ alias ]));
		} else {
			if (obj.indexOf('/') === 0) {
				return obj;
			}

			var joined = $.grep(args, function(elem) {
				return elem !== null;
			}).join("/");
			
			return joined + "/" + obj;
		}
	};

	// register defaults
	for (var alias in _defaults) {
		self.register(alias, _defaults[alias]);
	}

	return self;
};

/**
 * Create a new resource model. By default, the actions collections.list and
 * resources.detail are registered.s
 * 
 * @param _baseUrl
 *            base URL of all actions of this resource model
 * @param _defaults
 *            objects default actions.
 * 
 * 
 * @returns {sprat.uri.resourceModel}
 */
sprat.uri.resourceModel = function(_baseUrl, _defaults) {
	var self = this;

	var root = _baseUrl;

	// default actions
	var defaults = {
		// collections actions returns multiple resources
		collections : {
			"list" : ""
		},
		// resources actions return a single resource
		resources : {
			"detail" : "",
		}
	};

	// deep copy; overwrite *this* defaults with user provided defaults
	$.extend(true, defaults, _defaults);

	// register new actionMapper
	self.collections = new sprat.uri.actionMapper(root, defaults.collections);
	self.resources = new sprat.uri.actionMapper(root, defaults.resources);

	/**
	 * Return the {@link sprat.uri.actionMapper} for collections
	 * 
	 * @return sprat.uri.actionMapper
	 */
	self.collection = function() {
		return self.collections;
	};

	/**
	 * Return the {@link sprat.uri.actionMapper} for a resource
	 * 
	 * @param data
	 *            an integer or a Spring Data resource
	 * @return sprat.uri.actionMapper
	 */
	self.resource = function(data) {
		var resolvedId = self.resourceIdResolver(data);

		if (undefined === resolvedId) {
			return;
		}

		self.resources.arguments = [ resolvedId ];
		return self.resources;
	};

	/**
	 * Resolve the ID by examing the provided data. If data is an integer, it
	 * will be returned. If data is an object with property ._links.self, the
	 * resource ID of this entry is returned
	 * 
	 * @return integer|null null is returned if the parent resource itself
	 *         should be returned
	 * @throw if provided data does not contain an ID
	 */
	self.resourceIdResolver = function(data) {
		if (data === undefined || data === 0) {
			return null;
		}

		if (data % 1 === 0) {
			return data;
		}

		/*jshint -W069 */
		if (data && data["_links"] && data._links["self"]) {
			var s = data._links.self.href;
			// Spring Data REST: exclude templated string like 123{?projection}
			var id = s.substring(s.lastIndexOf("/") + 1);
			
			if (id.indexOf("{") > 0) {
				return id.substring(0, id.indexOf("{"));
			}

			return id;
		}

		throw "The provided resource resource is not an integer value nor does it contain the path _links.self with the root of the resource. Override .resource.rest.root";
	};
};

// register default actions for views
sprat.uri.resourceModel.defaults = function(_baseUrl, _defaults) {
	var defaults = {
		resources : {
			detail : {
				title : "Details",
				icon : "share"
			},
			edit : {
				title : "Bearbeiten",
				icon : "pencil"
			}
		}
	};

	return new sprat.uri.resourceModel(_baseUrl, $.extend(true, {}, defaults,
			_defaults));
};

/**
 * Return the value of the GET-parameter
 * @param parameter string name of GET parameter
 * @param search string|null if null, the window.location.search attribute is used. Otherwise the search string must begin with '?'
 * @return string|object
 */
sprat.uri.requestParameter = function(parameter, search) {
	var a = (search || window.location.search).substr(1).split('&');

	if (a === "")
		return {};
	var b = {};
	
	for (var i = 0; i < a.length; ++i) {
		var p = a[i].split('=');
		if (p.length != 2)
			continue;
		b[p[0]] = decodeURIComponent(p[1].replace(/\+/g, " "));
	}

	if (b && b[parameter]) {
		return b[parameter];
	}

	return b;
};
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

var sprat = sprat || {};
var $ = $ || {};

sprat.web = {
    uri: {
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
        parse: function(path, parameters) {
            var matcher = /\{([\?|\&]?)(\w*)(:(\w*))?\}/;

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
            function valueFor(prefix, identifier, _defaultValue, parameters) {
                parameters = parameters || {};

                // identifier is an integer
                if ($.isNumeric(identifier)) {
                    if (parseInt(identifier) < parameters.length) {
                        return prefix + parameters[parseInt(identifier)];
                    }
                }

                // find objects in parameter list and find the given key
                for (var i = 0; i < parameters.length; i++) {
                    if (typeof (parameters[i]) === 'object') {
                        if (parameters[i][identifier]) {
                            return prefix + parameters[i][identifier];
                        }
                    }
                    else {
                        if (parameters[i] == identifier) {
                            return prefix + identifier;
                        }
                    }
                }

                // parameters is an array
                for (var key in parameters) {
                    if (key == identifier) {
                        return prefix + parameters[key];
                    }
                }

                return _defaultValue || "";
            }

            var matches;

            // iterate over every match to make sure we can handle '/{0}/{1}/...'
            while (null !== (matches = matcher.exec(path))) {
                var replace = matches[0];
                path = path.replace(replace, valueFor(matches[1] /* prefix */, matches[2] /* parameter name */, matches[4] /* default value */, parameters));
            }

            return path;
        }
    },
	hateoas: {
		/**
		 * Return the href of the requested relation
		 * @param object an _embedded object or resource
		 * @param name string name of relation
		 * @param parameters optional parameters
		 * @return string
		 * @throws if relation could not be found
		 */
		relation:  function(object, name, parameters) {
			var links = null, href = null, rel = null;

			if (!object || !(object.links || object._links)) {
				throw "Invalid HATEOAS object without .links";
			}

			links = object._links || object.links;

			for ( var idx in links) {
				// { $relation: $href, $relation2: $href2 }
				if (typeof (links[idx]) === 'string') {
					rel = idx;
					href = links[idx];
				} else {
					if (typeof (links[idx]) === 'object') {
						var current = links[idx];

						// [{ rel: $relation, href: $href }]
						if (current.rel) {
							rel = current.rel;
							href = current.href;
						}
						// [{ $rel: { href: $href } }]
						else if (current[name] && current[name].href) {
							rel = name;
							href = current[name].href;
						}
						// in case of
						// object: {'_links' :  { 'foo' : { 'href' : '/foo/bar' }}}
						else if (idx == name && current.href) {
							rel = idx;
							href = current.href;
						}
					}
				}

				if (rel == name) {
					break;
				}

				href = undefined;
			}

			if (!href) {
				throw "HATEOAS relation with name '" + name + "' does not exist";
			}
			
			return sprat.web.uri.parse(href, parameters);
		},
		embedded: function(data) {
			if (data._embedded) {
				var key = null;
				
				for (key in data._embedded) {
					return data._embedded[key];
				}
			}

			return [];
		}
	},
};

// export
$hateoas = sprat.web.hateoas;
var sprat = sprat || {};
var $rest = $rest || {};

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
						util.debug("Received HTTP status code >= 200 && < 400, executing success pipe");

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
							util.debug("Failed to parse responseText as JSON, content '" + jqXHR.responseText + "'");
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
$rest.get = function() {
	return sprat.wrestle._delegateSimpleRequest(arguments, "GET");
};

/**
 * Execute a POST method
 * 
 * @return {function} $.ajax
 */
$rest.post = function() {
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
$rest.save = function(_url, _object, _context) {
	_context = _context || {};

	// inherit defaults
	_context.isPersisted = $rest.isPersisted(_object);

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
$rest.associationSave = function(_url, _references, _context) {
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
$rest.hateoasUpdate = function(_object, _assocs, _callback, _context) {
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
	arrMethods.push($rest.save(sprat.wrestle.hateoas.resourceLink('self', _object), _object, _context));

	// persist associations
	for (var resourceLink in resourceAssocs) {
		arrMethods.push($rest.associationSave(resourceLink, resourceAssocs[resourceLink], _context));
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
$rest.isPersisted = function(_object) {
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
sprat.ui.modal = function(_options) {
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
};
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
				// das backing-field enth�lt den eigentlichen
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
/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.navigation = sprat.ui.navigation || {};

sprat.ui.navigation.actions = {
	/**
	 * Create navigation buttons for table list views.
	 * Use sprat.ui.navigation.actions.create([...]).toString() to print out the actions.
	 * @param {array} actions Array of actions
	 */
	create : function(actions) {
		if (!jQuery.isArray(actions)) {
			throw "Argument is not an array";
		}
		
		jQuery.each(actions, function(idx, item) {
			if (!item.title || !item.url) {
				throw "You must provide an .title and an .url attribute for the action " + item;
			}
		});
		
		var result  = function(actions) {
			var self = this;
			self.actions = actions;
			
			/**
			 * Return a concatenated string with the requested actions.
			 * @param {array|null} _restrictActions If a valid array is given, only actions are concatted with matching .alias attributes
			 * @return {string}
			 */
			self.toString = function(_restrictActions) {
				var r = "", idx = null;
				
				var restrictActions = {
					_isRestricted: false
				};
				
				// build lookup table of actions are restricted
				if (jQuery.isArray(_restrictActions)) {
					restrictActions._isRestricted = true;
					
					for (idx in _restrictActions) {
						var restrictedAction = _restrictActions[idx];
						restrictActions[restrictedAction] = restrictedAction;
					}
				}
				
				for (idx in self.actions) {
					var action = self.actions[idx];
					var icon = "";
					
					// actions to be returned have been restricted and current action is not explicitly allowed
					if (restrictActions._isRestricted && (!action.alias || !restrictActions[action.alias])) {
						continue;
					}

					if (action.icon) {
						icon = "<i class='fa fa-" + action.icon + "'></i> ";
					}

					r += "<a href='" + action.url + "'><button class='btn btn-default'>" + icon + action.title + "</button></a>";
				}
				
				return r;
			};
		};
		
		return new result(actions);
	}
};

sprat.ui.navigation.menu = {
	/**
	 * Default callback handler for processing a hierarchical menu path. The
	 * attribute "navigation-parent-item" of the selected list element (higher
	 * priority) or the parent element (lower priority) will be used to identify
	 * a parent jQuery selector.
	 * 
	 * @param {string} liSelector
	 *            jQuery selector to list element to enable.
	 * @param {string} listOfVisitedLeafs
	 *			   out-parameter. Stores the the visited selectors/menu item path
	 * @returns {string|null} selector of parent list item
	 */
	_defaultVisitor : function(liSelector, listOfVisitedLeafs) {
		var ul = $(liSelector).closest("ul");

		var liSelectorParentItem = $(liSelector).attr("navigation-parent-item") || $(ul).attr("navigation-parent-item");

		// remove all active elements of current hierarchy level
		$(ul).find("li").removeClass("active");

		// if list element has a button, set it to btn-primary
		$(liSelector).find("button").toggleClass("btn-primary").toggleClass("btn-default");

		// push current visited menu item to the post-processor array
		listOfVisitedLeafs.push($(liSelector));

		if (liSelectorParentItem) {
			return liSelectorParentItem;
		}

		return null;
	},
	/**
	 * Add an "active" class to every selector in the given array of jQuery elements
	 * @param {array} visitedLeaf Array of jQuery elements
	 */
	_defaultPostProcessor : function(visitedLeafs) {
		for (var i = visitedLeafs.length - 1; i >= 0; i--) {
			visitedLeafs[i].addClass("active");
		}
	},
	/**
	 * Enable given navigation path or menu structure by iterating over all
	 * parent elements.
	 * 
	 * @param {string} leaf
	 *            jQuery selector with menu item to enable
	 * @param {function} [_callbackVisitor]
	 *            if not provided, sprat.ui.navigation.menu._defaultVisistor is used
	 * @param {function} [_callbackPostProcessor]
	 *            if not provided, sprat.ui.navigation.menu._defaultPostProcessor is used
	 * @param {array} [_visitedLeafs]
	 *			  Array of visited leafs. First element is the leaf node, last element is the root node
	 */
	traverse : function(leaf, _callbackVisitor, _callbackPostProcessor, _visitedLeafs) {
		var visit = _callbackVisitor;
		var postProcess = _callbackPostProcessor;

		if (!visit) {
			// no _callbackVisitor function has been provided
			visit = sprat.ui.navigation.menu._defaultVisitor;
		}

		if (!postProcess) {
			// no _callbackPostProcessor has been provided
			postProcess = sprat.ui.navigation.menu._defaultPostProcessor;
		}

		if (!_visitedLeafs) {
			// initialize _visitedLeafs array
			_visitedLeafs = [];
		}

		// visit current node
		var parent = visit(leaf, _visitedLeafs);

		if (parent) {
			// the node has a valid parent, so traverse to upper node
			sprat.ui.navigation.menu.traverse(parent, visit, postProcess, _visitedLeafs);
		} else {
			// the last visited leaf has no root node so it *was* the root node itself. postProcess all visited leafs
			postProcess(_visitedLeafs);
		}
	}
};
/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};

/**
 * Utility methods to render different types of data
 */
sprat.ui.renderer = (function() {
	var self = this;

	/**
	 * Return the renderer for the provided column. If "th.rdt-property" is
	 * set, the property renderer will be used. If you have defined an
	 * th.rdt-renderer, the specified renderer will overwrite the property
	 * renderer.
	 * 
	 * If no renderer could be found, the default renderer is used. It just
	 * returns the vanilla text.
	 * 
	 * @param {string} rendererName Name of renderer
	 * @param {object} any
	 *            Any number or type of object which shall be passed to the
	 *            renderer. The arguments will be appended to directly called
	 *            method argument
	 * @return {function}
	 */
	self.get = function(rendererName /* any arguments */) {
		// if method is called with other arguments, store them
		// note: arguments is *not* an array
		var initializerArguments = arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : [];

		var dispatcher = function() {
			var fullDispatchedArguments = $.merge([], $.merge(Array.prototype.slice.call(arguments),
					initializerArguments));

			// fall back to default renderer if needed
			var renderer = self.renderers["default"];

			var r = "";

			// renderer can be found by name
			if (self.renderers[rendererName]) {
				renderer = self.renderers[rendererName];
			} else {
				var matched = Object.byString(self.renderers, rendererName);
				
				if (undefined !== matched) {
					renderer = matched;
				}
			}

			// build response
			if (!renderer) {
				throw "Renderer '" + rendererName + "' has not been registered. Use sprat.ui.renderer.register($name, $callback) to register a renderer.";
			}
			
			if (typeof (renderer) === 'function') {
				r += renderer.apply(undefined, fullDispatchedArguments);
			} else if (typeof (renderer) === 'object' && renderer.ui) {
				if (typeof (renderer.ui) !== "function") {
					throw "The renderer '" + rendererName + "' is of type object and has the property 'ui' but 'ui' is not a method";
				}
				r += renderer.ui.apply(undefined, fullDispatchedArguments);
			} else {
				throw "The renderer '" + rendererName + "' is neither a function nor an object containing a method named 'ui'";
			}

			return r;
		};

		return dispatcher;
	};

	self.render = function(rendererName) {
		var renderer = self.get(rendererName);
		return renderer.apply(args);
	};

	/**
	 * Register a new renderer. You are allowed to overwrite the default
	 * renderer "date", "datetime", "timeageo", "default", "boolean" and "list".
	 * 
	 * @param {string} name
	 * @param {object} renderer
	 *            must be a method with parameter signature (data (property
	 *            value), type (property type), full (row));
	 * @returns {___anonymous_renderer}
	 */
	self.register = function(name, renderer) {
		this.renderers[name] = renderer;
		return this;
	};

	/**
	 * Store the registered column renderers
	 */
	self.renderers = {};

	return self;
})();
/** global sprat namespace */
var sprat = sprat || {};
sprat.ui = sprat.ui || {};
sprat.ui.validation = sprat.ui.validation || {};

sprat.ui.validation.errorDecorator = {
    defaultOptions: {
        form: {
            selector: "form:first",
            $instance: null,
            /**
             * Resolve input fields by their name. By default, the name attribute is looked up and then falls back to the ID attribute.
             * @param _field
             * @param $form
             * @return {jQuery}
             */
            resolveInput: function (_field, $form) {
                var $input = $form.find(":input[name='" + _field + "']");

                if ($input.length === 0) {
                    $input = $form.find("#" + _field);
                }

                if ($input.length === 0) {
                    return null;
                }

                return $input;
            }
        },
        errors: {
            /**
             * Display the summary inside the formular
             * @param _content
             * @param $form
             * @param _options
             */
            displaySummary: function(_content, $form, _options) {
                $form.prepend(_content);
            },
            /**
             * Method to transform an object to the expected error object
             * @param {array} _errors
             * @returns {array} [{field: "field", message: "Message}, {...}]
             */
            transform: function (_errors) {
                return _errors;
            },
            /**
             * Format the summary on top of the formular
             * @param {array} _errors
             * @param {array} _unmappedErrors Errors without any form binding
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatSummary: function (_errors, _unmappedErrors, _errorDecorator) {
                var msg = "Es sind " + _errors.length + " Validierungsfehler aufgetreten.", error = null;

                if (_unmappedErrors.length > 0) {
                    msg += "<ul>";

                    for (i = 0, m = _unmappedErrors.length; i < m; i++) {
                        error = _unmappedErrors[i];
                        msg += "<li>" + error.field + ": " + error.message + "</li>";
                    }

                    msg += "</ul>";

                    if (_unmappedErrors.length < _errors.length) {
                        msg += "Alle weiteren Fehler wurden an den jeweiligen Eingabefeldern markiert.";
                    }
                }

                return msg;
            },
            /**
             * Format the message which is bound directly to the input field
             * @param {string} _field
             * @param {string} _message
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatInputError: function (_field, _message, _errorDecorator) {
                return "<div class='" + _errorDecorator.options.cssHasError + " " + _errorDecorator.options.cssErrorText + "'><label class='control-label'>" + _message + "</label></div>";
            }
        },
        exception: {
            /**
             * Format an exception thrown by the backend
             * @param {object} _exception
             * @param {object} _errorDecorator instance
             * @returns {string}
             */
            formatException: function (_exception, _errorDecorator) {
                return "<div class='" + _errorDecorator.options.cssErrorText + " alert alert-danger'>Es sind Fehler in der Anwendung aufgetreten: " + _exception.message + "</div>";
            }
        },
        cssErrorContainer: "error-container",
        cssHasError: "has-error",
        cssErrorText: "error-text"
    },
    /**
     * Setup the default configuration. By default we expect Spring data structures. "laravel" is supported as flavor.
     */
    configure: function () {
        var isInitialized = requireSpratAppInitialized() || (function () {
                throw "sprat/app.js not included?";
            })();

        switch (sprat.$spratAppInstance.flavor()) {
            case "spring":
                sprat.ui.validation.errorDecorator.configureSpring();
                break;
            case "laravel":
                sprat.ui.validation.errorDecorator.configureLaravel();
                break;
        }
    },
    /**
     * Configure data transformer for Laravel
     */
    configureLaravel: function () {
        sprat.ui.validation.errorDecorator.defaultOptions.errors.transform = function (_errors) {
            var r = [];

            if (_errors !== null && typeof _errors === 'object') {
                for (var key in _errors) {
                    r.push({field: key, message: _errors[key]});
                }
            }

            return r;
        };
    },
    /**
     * Configure Spring transformer
     */
    configureSpring: function () {
        sprat.ui.validation.errorDecorator.defaultOptions.errors.transform = function (_errors) {
            return _errors;
        };
    }
};

/**
 * Use ErrorDecorator for binding validation errors from the backend the input fields in the frontend.
 *
 * @param {object|jQuery} options
 *  .form.$instance {jQuery object} use this element as form and not the selector
 *  .form.selector  {string} jQuery selector to select the bound form. By default, form:first is used
 *  .errors.transform {function} callback method to transform an error array into the expected format.
 *      By default ErrorDecorator expects validation errors based upon the result of Spring MVC/Data. Use app.flavor == "laraval"
 *      to initialize a callback method for Laravel
 *  .errors.formatSummary {function(_errors, _unmappedErrors)} callback method to display the error summary
 *  .errors.formatInputError {function(_field, _message)} callback method to format the input error bind directly to the input field
 *  .exception.formatException {function(_exception}} function to format an exception
 *  .cssErrorContainer {string} CSS class for marking a container with error
 *  .cssHasError {string} CSS class
 *  .cssErrorText {string} CSS class
 *
 *  If the options parameters is of type jQuery, the form decorator is bound to the provided element.
 * @constructor
 */
sprat.ui.validation.errorDecorator.create = function (options) {
    function instance(options) {
        var self = this;

        options = options || {};

        if (options instanceof jQuery) {
            var useInstance = options;

            options = {
                form: {
                    "$instance": useInstance
                }
            };
        }

        // let the provided options override the default options but don't touch the original default options
        self.options = $.extend(true, $.extend(true, [], sprat.ui.validation.errorDecorator.defaultOptions), options);

        // resolve the form to bind by an selector or an existing jQuery instance. the instance has precedence.
        self.$form = self.options.form.$instance || $(self.options.form.selector);

        /**
         * Remove all .has-error and .error-text elements from the canvas
         */
        self.clear = function () {
            var cssHasError = self.options.cssHasError;

            self.$form.find("." + cssHasError).removeClass(cssHasError);
            self.$form.find(".error-text").remove();
        };

        /**
         * Append the self.options.cssHasError CSS class to every div container which is marked with CSS class self.options.cssErrorContainer.
         */
        self.highlightInputErrors = function () {
            $("div." + self.options.cssErrorContainer).each(function () {
                $(this).closest(".form-group").addClass(self.options.cssHasError);
            });
        };

        /**
         * Show the exceptions.
         * @param {object} _exception exception object
         */
        self.updateException = function (_exception) {
            self.clear();

            self.$form.prepend(self.options.exception.formatException(_exception, self));
        };

        /**
         * Update the bind form with the errors. Every occured error before will be removed.
         * This method automatically calls self.options.errors.transform to convert any error parameter in the expected format.
         *
         * @param {{Array|Object}} errors
         * @returns {*}
         */
        self.updateErrors = function (errors) {
            self.clear();

            if (!errors) {
                return 0;
            }

            errors = self.options.errors.transform(errors);
            return self.bindErrors(errors);
        };

        /**
         * Bind an array of errors to the input field. This method has been primarily designed for Spring MVC/Spring data
         * validation, so the given parameters must have the expected format.
         *
         * @param {array} errors in format [{ field: "my_field", message: "my_message"}, { field: "field_2", message: "message" }]
         * @return {object} validation results
         */
        self.bindErrors = function (errors) {
            var i = 0, m = 0, error = null, ctx = null;

            var r = {
                unmappedErrors: [],
                mappedErrors: [],
                length: errors.length,
                summary: ""
            };
            // unmapped errors are errors which could not be bound to the field. they are displayed later on top of the form
            var unmappedErrors = [];

            for (i = 0, m = errors.length; i < m; i++) {
                error = errors[i];

                // Different field names:
                // - Laravel: field
                // - org.springframework.validation.BindException: field
                // - org.springframework.data.rest.core.ValidationErrors: property
                var field = error.field || error.property;

                var message = error.message || error.defaultMessage;
                // find the input (input=text, textarea, select) by its name attribute in first place

                input = self.options.form.resolveInput(field, self.$form);

                // ctx = current message context
                ctx = {field: field, message: message, $input: $(input)};

                // input field could not found by its name attribute
                if (!input) {
                    r.unmappedErrors.push(ctx);
                    continue;
                }

                r.mappedErrors.push(ctx);

                var parentDiv = input.closest('.form-group');

                // mark parent div as erroneous
                parentDiv.addClass(self.options.cssHasError);
                // and add the error text
                $(input).after(self.options.errors.formatInputError(field, message, self));
            }

            // show unmapped errors if any
            if (errors.length > 0) {
                r.summary = self.options.errors.formatSummary(errors, r.unmappedErrors, self);
                var summary = "<div class='" + self.options.cssErrorText + " alert alert-danger validation-summary'>" + r.summary + "</div>";
                self.options.errors.displaySummary(summary, self.$form, self.options);
            }

            return r;
        };
    }

    return new instance(options);
};
/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.component = sprat.ui.component || {};

/**
 * Maps Spring Data REST or Spring Data HATEOAS endpoints to the jQuery DataTable plug-in.
 * @param {object} _defaults Datatable options
 * @return ComponentDataTable
 */
sprat.ui.component.dataTable = function (_defaults) {
    var ComponentDataTable = function (_defaults) {
        var self = this;
        self.defaults = _defaults || {};

        // private section
        var _internal = {
            cssClasses: {
                "isOrderable": "is-orderable",
                "isSearchable": "is-searchable"
            },
            attributes: {
                prefix: "sprat-datatable-",
                renderer: "renderer",
                property: "property",
                alias: "alias"
            }
        };

        /**
         * Internal utility methods for sprat.ui.component.dataTable
         */
        var util = {
            /**
             * Is the given attribute present in the provided jQuery element
             */
            isOptionPresent: function (jqElem, option) {
                return this.optionValue(jqElem, option) !== null;
            },
            /**
             * Is given CSS class present
             */
            isCssClassPresent: function (jqElem, clazz) {
                return jqElem.hasClass(_internal.attributes.prefix + clazz);
            },
            /**
             * Returns the value of HTML attribute. This methods prepends the "sprat-datatable-"
             * prefix.
             */
            optionValue: function (jqElem, option) {
                var r = jqElem.attr(_internal.attributes.prefix + option);

                if (r === undefined) {
                    return null;
                }

                return r;
            }
        };

        var instance = {
            /**
             * base URL for all REST queries
             */
            restEndpoint: null,
            /**
             * Array with URLs which can be used for altering the next GET request
             */
            endpointQueue: [],
            initialized: false,
            lastReceivedData: null,
            options: {
                springDataAttribute: null,
                requestParameters: {},
                datatable: {
                    "order": [0, "desc"],
                    "jQueryUI": false,
                    "stateSave": true,
                    "serverSide": true,
                    "ordering": true,
                    "paging": true,
                    "searching": false,
                    "pagingType": "full_numbers",
                    "language": {
                        "processing": "Verarbeite...",
                        "lengthMenu": '<span class="itemsPerPage">Eintr&auml;ge pro Seite:</span> <span style="font-size: 11px;">_MENU_</span>',
                        "zeroRecords": "Keine Eintr&auml;ge gefunden",
                        "emptyTable": "Keine Eintr&auml;ge vorhanden",
                        "loadingRecords": "Lade...",
                        "info": "Zeige _START_ bis _END_ von _TOTAL_ Eintr&auml;gen",
                        "infoEmpty": "Zeige 0 bis 0 von 0 Eintr&auml;gen",
                        "infoFiltered": "(_MAX_ insgesamt)",
                        "infoPostFix": "",
                        "thousands": ".",
                        "search": "Suche:",
                        "url": "",
                        "paginate": {
                            "first": "Erste",
                            "previous": "Vorherige",
                            "next": "N&auml;chste",
                            "last": "Letzte"
                        }
                    },
                }
            },
            columnDefinitions: [],
            mappedColumns: {},
            dataTable: null,
        };

        var datatableDefaults = {
            "ajax": function (data, callback, settings) {
                // page calculations
                var draw = data.draw;
                var pageSize = data.length;
                var start = data.start;
                var pageNum = (start === 0) ? 0 : (start / pageSize);
                var sorting = {dir: null};

                if (data.order && data.order.length >= 0) {
                    sorting = data.order[0];
                }

                var sortDir = sorting.dir;

                var sortCol = $(this).find("thead > tr > th").eq(sorting.column).attr(
                    _internal.attributes.prefix + _internal.attributes.property);

                var defaultRequest = {
                    "size": pageSize,
                    "page": pageNum
                };

                if (sortCol) {
                    defaultRequest.sort = sortCol + "," + sortDir;
                }

                var request = $.extend(true, defaultRequest, instance.options.requestParameters);
                var endpoint = self.getEndpoint();

                $rest.get(endpoint, request, function(afterReceive) {
                    var r = instance.convertResponseToDatatable(afterReceive, draw);
                    callback(r);
                });
            }
        };

        /**
         * Return last received data from backend, containing the whole AJAX response.
         * @return {object}
         */
        self.lastReceivedData = function () {
            return instance.lastReceivedData;
        };

        /**
         * Bind jQuery table element to the backing datatable
         * @param {object} _table jQuery element
         * @return ComponentDataTable
         */
        self.bindTable = function (_table) {
            if (!(_table instanceof jQuery)) {
                throw "bindTable argument must be a jQuery table element";
            }

            instance.table = _table;
            _table.data("sprat-datatable", self);

            return self;
        };

        /**
         * Bind table to given Spring Data REST endpoint
         * @param {string} _endpoint URL of Spring Data REST endpoint
         * @return ComponentDataTable
         */
        self.toEndpoint = function (_endpoint) {
            instance.restEndpoint = _endpoint;
            return self;
        };

        /**
         * Set the Spring Data REST "_embedded.*" key to lookup the data
         *
         * @param {string} _attribute
         * @return {ComponentDataTable}
         */
        self.withSpringDataAttribute = function (_attribute) {
            instance.options.springDataAttribute = _attribute;
            return self;
        };

        /**
         * Configure GET parameters for every request
         *
         * @param _parameters
         * @returns {ComponentDataTable}
         */
        self.withRequestParameters = function (_parameters) {
            instance.options.requestParameters = _parameters;
            return self;
        };

        /**
         * Map multiple columns to their corresponding renderer. You can use a numeric value (index based), a property name or an alias.
         *
         * @param {object} mappedColumns
         * @return ComponentDataTable
         */
        self.mapColumns = function (mappedColumns) {
            instance.mappedColumns = mappedColumns;
            return self;
        };

        /**
         * Set Datatable options
         *
         * @param {object} options
         * @return {ComponentDataTable}
         */
        self.datatableOptions = function (options) {
            instance.options.datatable = options;
            return self;
        };

        /**
         * Map on column to their corresponding renderer.
         *
         * @param {{numer|string}} columnIdx numeric value (index based) or string (property name or alias)
         * @param {object} mapColumn
         * @return self
         */
        self.mapColumn = function (columnIdx, mapColumn) {
            instance.mappedColumns[columnIdx] = mapColumn;
            return self;
        };

        /**
         * This callback is executed after a row has been rendered
         *
         * @param {function} callback
         * @return ComponentDataTable
         */
        self.afterCreatedRow = function (callback) {
            instance.options.datatable.createdRow = callback;
            return self;
        };

        /**
         * Return the DataTable instance
         * @return DataTable
         */
        self.dataTable = function () {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before returning the datatable";
            }

            return instance.table.DataTable();
        };


        /**
         * Execute a reload of the underlying datatable. If it is not intialized yet, it gets initialized
         */
        self.reload = function() {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before changing the source";
            }

            // underlying dataTable has not been initialized
            if (!instance.dataTable) {
                self.initDataTable();
                // no need to call .ajax.reload() b/c it is already done through initializing.
            }
            else {
                self.dataTable().ajax.reload();
            }
        };

        /**
         * Change the REST endpoint and do a reload of the backed table.
         * If the underlying DataTable is not already initialized, it will get initialized by calling self.initDataTable().
         * @param {string} source URL
         * @return ComponentDataTable
         */
        self.updateEndpoint = function (source) {
            if (!instance.initialized) {
                throw "DataTable not initialized. You must call build() before changing the source";
            }

            // self.dataTable().ajax.url(...) would change our callback handler.
            instance.restEndpoint = source;

            self.reload();
        };

        /**
         * Enqueues a new endpoint path which will be executed for the next request
         * @param {string} source URL
         * @param {boolean} execute reload instantly
         * @return ComponentDataTable
         */
        self.enqueueEndpoint = function(source, instantReload) {
            instance.endpointQueue.push(source);

            if (instantReload) {
                self.reload();
            }

            return self;
        };

        /**
         * Return the next executable endpoint
         * @return string
         */
        self.getEndpoint = function() {
            if (instance.endpointQueue.length > 0) {
                return instance.endpointQueue.pop();
            }

            // fallback to the default endpoint
            return instance.restEndpoint;
        };

        /**
         * Return instance and its configuration
         * @return ComponentDataTable
         */
        self.config = function() {
            return instance;
        };

        /**
         * Initialize the datatable. Throw an error if it is already initialized
         * @return ComponentDataTable
         */
        self.initDataTable = function() {
            if (instance.dataTable) {
                throw "DataTable of this instance is already initialized";
            }

            // create datatable instance
            instance.dataTable = instance.table.dataTable(instance.options.datatable);
            return self;
        };

        /**
         * Build datatable
         * @param {boolean} initialize if given and false then the datatable is not initialized. If this option is missed, the datatable gets initialized automatically
         * @return ComponentDataTable
         */
        self.build = function () {
            // inherit default options
            $.extend(true, instance.options.datatable, self.defaults, datatableDefaults);

            if (!instance.table) {
                throw "Datatable has not been bound by calling bindTable()";
            }

            if (!instance.restEndpoint) {
                throw "REST endpoint has not been configured by calling toEndpoint()";
            }

            /**
             * Updates the instance.columnDefinitions. Should only be called once on
             * initializing. Please use .initialize()
             */
            instance.buildColumnDefinitions = function () {
                if (instance.initialized) {
                    return;
                }

                var definitions = [];


                // find header descriptions
                instance.table.find("thead > tr > th").each(function (idx, value) {
                    var attributeValue = null;
                    // defaults
                    var spec = {
                        "targets": idx,
                        "orderable": false,
                        "searchable": false,
                        "data": null,
                    };

                    // class="sprat-datatable-is-orderable" has been set
                    if (util.isCssClassPresent($(this), _internal.cssClasses.isOrderable)) {
                        spec.orderable = true;
                    }

                    if (util.isCssClassPresent($(this), _internal.cssClasses.isSearchable)) {
                        spec.searchable = true;
                    }

                    // sprat-datatable-renderer has been set
                    if (null !== (customRenderer = util.optionValue($(this), _internal.attributes.renderer))) {
                        if (!sprat.ui || !sprat.ui.renderer) {
                            throw "You are using a customer renderer but sprat.ui has not been included. Add <script src='$SPRAT_PATH/dist/ui/renderer.js'></script> to your HTML file";
                        }

                        spec.render = sprat.ui.renderer.get(customRenderer, instance);
                    }

                    // sprat-datatable-property
                    if (null !== (attributeValue = util.optionValue($(this), _internal.attributes.property))) {
                        spec.name = attributeValue;
                        spec.data = attributeValue;
                    }

                    // sprat-datatable-alias has been set
                    var useAlias = util.optionValue($(this), _internal.attributes.alias) || -1;

                    // check programatically configuration of this table.
                    var configuredRenderer = instance.mappedColumns[useAlias] || instance.mappedColumns[idx];

                    if (configuredRenderer) {
                        spec.render = configuredRenderer;
                    }

                    if (!spec.render) {
                        console.warn("Column idx" + idx + " has no renderer. Using default renderer");
                        spec.render = function (data, type, full, last) {
                            return data;
                        };
                    }

                    definitions.push(spec);
                });

                instance.initialized = true;
                return definitions;
            };

            /**
             * Will be executed after data has been received from REST endpoint
             *
             * @param {object} json JSON data retrieved from the endpoint
             * @param {object} draw
             *            jQuery DataTable object
             */
            instance.convertResponseToDatatable = function (json, draw) {
                instance.lastReceivedData = json;

                // we use JSONSelect for selecting JSON elements
                var recordsTotalSelector = ".totalElements";
                var recordsFilteredSelector = ".totalElements";
                // assume that the content is stored in the array with the JSON property name "content"
                var dataSelector = "array.content";

                var r = {
                    "recordsTotal": 0,
                    "recordsFiltered": 0,
                    "data": [],
                    "draw": draw
                };

                if (instance.options.springDataAttribute) {
                    dataSelector = "._embedded ." + instance.options.springDataAttribute;
                }

                if (instance.options.datatable.selector) {
                    recordsTotalSelector = instance.options.datatable.selector.recordsTotal || recordsTotalSelector;
                    recordsFilteredSelector = instance.options.datatable.selector.recordsFiltered || recordsFilteredSelector;
                    dataSelector = instance.options.datatable.selector.data = dataSelector;
                }

                if (!dataSelector) {
                    throw "No dataSelector set";
                }

                if (window.JSONSelect) {
                    r.recordsFiltered = window.JSONSelect.match(recordsFilteredSelector, json)[0];
                    r.recordsTotal = window.JSONSelect.match(recordsTotalSelector, json)[0];

                    // only filter any data if data is really available
                    if (r.recordsTotal > 0) {
                        var matchedData = window.JSONSelect.match(dataSelector, json);
                        r.data = matchedData[0];

                        if (undefined === r.data) {
                            throw "Could not find any data for selector '" + dataSelector + "'. Check your selector for any typos. Maybe you are missing a withSpringDataAttribute() call?";
                        }
                    }
                } else {
                    throw "No JSONSelect on path (http://jsonselect.org/)";
                }

                return r;
            };

            instance.options.datatable.columnDefs = instance.buildColumnDefinitions();

            if (!instance.table.dataTable) {
                throw "sprat.ui.component.dataTable requires DataTables (https://www.datatables.net/).";
            }

            var initializeDataTable = true;

            // if first parameter is passed (initialized datatable: boolean), load it
            if (arguments.length > 0) {
                initializeDataTable = arguments[0];
            }

            if (initializeDataTable) {
                self.initDataTable();
            }

            return self;
        };

        return self;
    };

    return new ComponentDataTable(_defaults);
};
/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.component = sprat.ui.component || {};
sprat.ui.component.dataTable = sprat.ui.component.dataTable || {};

/**
 * Enable custom scopes for sprat.ui.component.dataTable
 * @param {object} dataTable sprat.ui.component.dataTable
 * @param {object} _config optional config
 */
sprat.ui.component.dataTable.scopeable = function(dataTable, _config) {
    var DataTableDecoratorScopeable = function(dataTable, _config) {
        var self = this;

        // expect sprat.ui.component.dataTable. It is not possible to determine the correct type, b/c it is anonymous.
        if (!dataTable || !dataTable.config) {
            throw "sprat.ui.component.dataTable.scopeable requires sprat.ui.component.dataTable instance as first argument";
        }

        var defaults = {
            /**
             * GET parameter which is used for activating a specific scope on load
             */
            requestdScopeHttpGetParam: "scope",
            endpoint: {
                /**
                 * REST endpoint to user
                 */
                url: undefined,
                /**
                 * Builder to create a endpoint URL for a given scope.
                 * @param {string} scope if not empty, the ?scope= parameter is set for the dataTable by using .withRequestParameters
                 * @param {object} dataTable
                 * @param {object} config configuration
                 * @return string
                 */
                builder: function (scope, dataTable, config) {
                    dataTable.withRequestParameters({
                        "scope": scope
                    });

                    return config.endpoint.url;
                }
            },
            widget: {
                /**
                 * jQuery selector to identify scoping widgets
                 */
                selector: "button.sprat-query",
                /**
                 * enable a widget
                 * @param {object} $item jQuery item
                 */
                enable: function ($item) {
                    $item.removeClass("btn-default");
                    $item.addClass("btn-primary");
                },
                /**
                 * disable a widget
                 * @param {object} $item jQuery item
                 */
                disable: function ($item) {
                    $item.removeClass("btn-primary");
                    $item.addClass("btn-default");
                }
            }
        };

        self.dataTable = dataTable;
        // merge user-defined configuration with default configuration
        self.config = $.extend(true, {}, defaults, _config);

        // if the endpoint has not been defined, it is taken from the dataTable object
        if (!self.config.endpoint.url) {
            self.config.endpoint.url = dataTable.config().restEndpoint;
        }

        var util = {
            /**
             * return GET parameter from requested URL
             * @param {string} name name of GET parameter
             * @return string|null
             */
            getParam: function (name) {
                var results = new RegExp('[\?&]' + name + '=([^&#]*)').exec(window.location.href);

                if (results === null) {
                    return null;
                }

                return decodeURIComponent(results[1]) || null;
            }
        };

        /**
         * Get the scope which the user has been requested by appending ?scope=XYZ to the URL
         * @return string|undefined
         */
        self.requestedScope = function () {
            var scope = util.getParam(self.config.requestdScopeHttpGetParam);

            if ($("button[sprat-query-scope='" + scope + "']").length > 0) {
                return scope;
            }

            return undefined;
        };

        /**
         * Find the widget for given scope
         * @param {string} scope name of scope to be activated. Can be explicitly null or undefined to identify the default scope
         * @return jQuery item or null
         */
        self.findScopeWidget = function (scope) {
            var items = $(self.config.widget.selector);
            var item = null, queryScope = null;

            for (var i = 0, m = items.length; i < m; i++) {
                item = items[i];
                queryScope = $(item).attr('sprat-query-scope');

                // default scope
                if (!scope && !queryScope) {
                    return item;
                }

                if (scope == queryScope) {
                    return item;
                }
            }

            return null;
        };

        /**
         * Find the widget with the current scope
         * @return jQuery item or null
         */
        self.findCurrentWidget = function() {
            return self.findScopeWidget(self.currentScope);
        };

        /**
         * Enable the scope with the given name. If the scope is available, the widget scope gets activated. All other scopes gets deactivated. The REST endpoint of the connected dataTable is updated and a reload is triggered.
         * @param {string} scope name of scope to activate, can be empty or undefined to identify the default scope. If the scope does not exist, an exception is thrown.
         * The event "scope-activated[name_of_scope]" is triggered.
         */
        self.enableScope = function (scope) {
            var widget = self.findScopeWidget(scope);

            if (!widget) {
                throw "Trying to activate non-existing scope '" + scope + "'";
            }

            self.currentScope = scope;

            $(self.config.widget.selector).each(function () {
                if ($(this).is($(widget))) {
                    self.config.widget.enable($(this));
                }
                else {
                    self.config.widget.disable($(this));
                }
            });

            // populate event to make interactions possible
            $(this).trigger("scope-activated", [ self.currentScope ]);

            self.dataTable.config().table.trigger("scope-activated", [ self.currentScope ]);

            // update the endpoint of the underlying data
            self.dataTable.updateEndpoint(self.config.endpoint.builder(self.currentScope, self.dataTable, self.config));
        };

        self.init = function() {
            // bind widgets
            $(self.config.widget.selector).click(function() {
                self.enableScope($(this).attr('sprat-query-scope'));
            });

            self.enableScope(self.requestedScope());
            self.dataTable.config().table.data("sprat-datatable-scopeable", self);

            return self;
        };
    };

    return new DataTableDecoratorScopeable(dataTable, _config);
};
/** global sprat namespace */
var sprat = sprat || {};

sprat.ui = sprat.ui || {};
sprat.ui.component = sprat.ui.component || {};
sprat.ui.component.dataTable = sprat.ui.component.dataTable || {};

/**
 * Enable custom scopes for sprat.ui.component.dataTable
 * @param {object} dataTable sprat.ui.component.dataTable
 * @param {object} _config optional config
 */
sprat.ui.component.dataTable.searchable = function(dataTable, _config) {
    var DataTableDecoratorSearchable = function(dataTable, _config) {
        var self = this;

        // expect sprat.ui.component.dataTable. It is not possible to determine the correct type, b/c it is anonymous.
        if (!dataTable || !dataTable.config) {
            throw "sprat.ui.component.dataTable.searchable requires sprat.ui.component.dataTable instance as first argument";
        }

        var defaults = {
            endpoint: {
                url: null
            },
            formAsQuery: function() {
                return null;
            },
            widget: {
                selector: ".sprat-search",
                scoping: null,
                close: function() {
                    // hide search
                    $(".box-search [data-widget='collapse']").click();
                }
            }
        };

        self.dataTable = dataTable;
        // merge user-defined configuration with default configuration
        self.config = $.extend(true, {}, defaults, _config);

        // if the endpoint has not been defined, it is taken from the dataTable object
        if (!self.config.endpoint.url) {
            self.config.endpoint.url = dataTable.config().restEndpoint;
        }

        /**
         * Set callback function to serialize a search formular
         * @param {function} formAsQuery
         * @return DataTableDecoratorSearchable
         */
        self.formAsQuery = function(formAsQuery) {
            self.config.formAsQuery = formAsQuery;
            return self;
        };

        /**
         * Set endpoint for API search requests.
         * @param {string} url can be absolute (starting with a "/") or relative to the dataTable URL
         * @return DataTableDecoratorSearchable
         */
        self.withEndpoint = function(url) {
            if (url.startsWith("/")) {
                self.config.endpoint.url = url;
            }
            else {
                // url parameter is below main URL
                self.config.endpoint.url += "/" + url;
            }

            return self;
        };

        /**
         * Initialize the search box
         */
        self.init = function() {
            // if scoping is enabled, listen to events on activated scoping
            $(self.dataTable.config().table).on("scope-activated", function() {
                // a selected scoping closes the search box
                self.config.widget.close();
            });

            $(self.config.widget.selector).click(function() {
                // convert input parameters to a hashmap
                var requestParameters = self.config.formAsQuery();

                if (!requestParameters) {
                    // no request parametesr => don't execute a search
                    return false;
                }

                var scopeable = self.dataTable.config().table.data("sprat-datatable-scopeable");

                // if scoping is enabled, disable any active scope
                if (scopeable) {
                    scopeable.config.widget.disable($(scopeable.findCurrentWidget()));
                }

                // update request parameters for next GET request
                self.dataTable.withRequestParameters(requestParameters);
                // enqueue the next request and execute immediately. The enqueuement ensures that the original datatable REST URL doesn't get modified
                self.dataTable.enqueueEndpoint(self.config.endpoint.url, true /* execute immediately */);
            });
        };
    };

    return new DataTableDecoratorSearchable(dataTable, _config);
};