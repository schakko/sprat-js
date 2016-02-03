sprat.security
==================
Security add-ons for Spring Security and other security related features.

Usage
=====

Enable CSRF tokens
------------------
CSRF tokens are needed for doing HTTP requests with Spring Security enabled web applications.

Put the following into your header

	<meta name="_csrf" th:content="${_csrf.token}" />
	<meta name="_csrf_header" th:content="${_csrf.headerName}" />

And add the following function call to your app.js

	app.init = function() {
		// enable CSRF tokens
		sprat.security.configureSpringSecurityCsrfToken();
	};


