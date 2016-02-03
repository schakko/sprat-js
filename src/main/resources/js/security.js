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