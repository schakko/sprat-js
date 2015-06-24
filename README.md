# sprat-js
sprat-js has been originally developed to support common web development tasks during the work with the Spring framework. Over the time sprat-js has been used for other frameworks than Spring (e.g. Laravel).

# Usage
The *dist/* directory itself contains some *README.\*.md* files for the different parts of *sprat.js*. 

Please take a look into the *test/* directory which contains QUnit tests and samples. 
The *vendor/* library contains third party libraries like *jsonselect.js*

# Development
## Grunt
Run

	# install Grunt command line interface
	npm -g install grunt-cli
	# install dependencies from package.json
	npm install

before using 

	grunt
	
to execute the Gruntfile.js

## Deploy
	
	#  run Grunt to execute JSHint, unit tests, concat & minify
	grunt
	# create new tag 
	git tag $version
	# push to GitHub, including the previously created tag(s)
	git push --tags
	
bower.io identifies packages by their Git tag.
	
# Licensing
The source code inside the *dist/* directory is licensed under the BSD license for open source- and non-commercial projects. For the usage in commercial projects please contact me[at]schakko[dot]de.

