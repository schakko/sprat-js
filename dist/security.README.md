# sprat.security
Client side security add-ons for features like CSRF.

## Enable CSRF tokens
CSRF tokens are needed for executing HTTP POST requests with web applications based upon frameworks like Spring Security or Laravel.

### Spring Security and Thymeleaf
Put the following into your header:

	<meta name="_csrf" th:content="${_csrf.token}" />
	<meta name="_csrf_header" th:content="${_csrf.headerName}" />

your *app.js*:

	app.init = function() {
		// enable CSRF tokens
		sprat.security.csrf.configureSpringSecurity();
	};

### Laravel

*header.blade.php*:

	<meta name="_csrf" content="{{ csrf_token() }}" />

your *app.js*:

	app.init = function() {
		// enable CSRF tokens
		sprat.security.csrf.configureLaravel();
	};

### Auto-configuration

	var app = new sprat.app({ 
		flavor: "spring", // or any other flavor
		configure: function() {
			sprat.security.csrf.configure();
		}
	});
	
	app.initialize();
