# sprat-js
A library of different JavaScript files for supporting the development workflow with Spring MVC, Spring Data *, Thmyeleaf, Laravel and AngularJS.

This repository contains two different files:

- *sprat.js* contains only basic functions. Some of them require jQuery to work.
- *sprat-angular.js* uses *sprat.js* and *angular.js*.

# Usage
The *src/main/resources* directory contains some *README.\*.md* files for the different parts of *sprat.js*. For some parts of it we provides usage samples.
For the usage of the different parts please take a look into the *src/test/resources* directory. The unit tests are based upon Jasmine.

### WebJar
Include the following in your *pom.xml*:

	<dependency>
		<groupId>org.webjars</groupId>
		<artifactId>sprat-js</artifactId>
		<version>${sprat-js.version}</version>
	</dependency>

The following JavaScript files must be included in your view/HTML:

	org.webjars.sprat-js/${version}/dist/sprat.js
	org.webjars.sprat-js/${version}/dist/sprat-angular.js

### Bower
tbd

# Development
This project uses Grunt at its core. In addition to that Maven is used for creating the WebJar.

## Requirements
Run

	# install Grunt command line interface
	npm -g install grunt-cli
	# install dependencies from package.json
	npm install

before using 

	grunt
	
to execute the *Gruntfile.js*

## Testing
Tests are written with the Jasmine framework and can be run with

	grunt jasmine

Please note that you can **not** use the *jasmine-jquery.loadFixture()* method, b/c *grunt-contrib-jasmine* and *jasmine-maven-plugin* are not compatible. Each framework uses different strategies to map local files to the local webserver root path.
*jasmine-maven-plugin* enforces the base path "spec/" which is not mapped by *grunt-contrib-jasmine*. Because of this, fixtures have to be defined as inline strings.

## Building the framework
### Grunt
Run 
	
	grunt 

and you are fine. The tests are executed, the source gets concated and the *dist/* directory is updated with the new version

### Maven
Run

	mvn clean package
	
and you are fine. The pom.xml contains dedicated plug-in configurations for Jasmine and PhantomJS but they are disabled. It is much easier to execute Grunt through Maven which is done by the command line above.
Please note that you - if you want to use the jasmine-maven-plugin - **need at least Maven 3.1** for executing the Jasmine tests!

## Releasing a new version
You have to upgrade the following files

 - `pom.xml`: *version* tag
 - `package.json`: *version* attribute
 - `bower.json`: *version* attribute
 
## Deployment
### bower.io

	#  run Grunt to execute JSHint, unit tests, concat & minify
	grunt
	# create new tag 
	git tag $version
	# push to GitHub, including the previously created tag(s)
	git push --tags
	
*bower.io* identifies the packages by their Git tag.

### Artifactory
Your local build server (Jenkins, Hudson, TeamCity, ...) should be set up to deploy the WebJar into your company Maven repository. At the moment there is no plan to deploy the WebJar on Maven Central.

## Workflow
Please fork this repository and create a pull request. Git as usual.

# Licensing
The source code inside this repository is available under the BSD license for open source- and non-commercial projects. For the usage in commercial projects please contact me[at]schakko[dot]de.