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