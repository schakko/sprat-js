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
