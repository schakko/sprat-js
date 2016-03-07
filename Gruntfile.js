module.exports = function( grunt ) {
    "use strict";

    var dirs = ["src/main/resources/js/*.js", "src/test/resources/js/*.js"];

    grunt.initConfig({
		jasmine: {
			src: [ "src/main/resources/js/**/**.js" ],
			options: {
				specs: [ "src/test/resources/js/**/**.js"],
				vendor: [ 
					"https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular.min.js",
					"https://ajax.googleapis.com/ajax/libs/angularjs/1.4.5/angular-mocks.js",
					"src/main/resources/js/vendor/*.js", 
					"src/test/resources/js/vendor/jquery-1.12.0.js",
				],
				summary: false
			}
		},
        jshint: {
            files: dirs
        },
        concat: {
            dist: {
                src: [
                    'src/main/resources/js/vendor/jsonselect.js',
                    'src/main/resources/js/app.js',
                    'src/main/resources/js/path.js',
                    'src/main/resources/js/security.js',
                    'src/main/resources/js/uri.js',
                    'src/main/resources/js/util.js',
                    'src/main/resources/js/web.js',
                    'src/main/resources/js/wrestle.js',
                    'src/main/resources/js/ui/core.js',
                    'src/main/resources/js/ui/datetime.js',
                    'src/main/resources/js/ui/navigation.js',
                    'src/main/resources/js/ui/renderer.js',
                    'src/main/resources/js/ui/validation.js',
                    'src/main/resources/js/ui/component/datatable.js',
                    'src/main/resources/js/ui/component/datatable/scoping.js',
                    'src/main/resources/js/ui/component/datatable/search.js',
                    'src/main/resources/js/ui/component/renderer/custom.js',
                ],
                dest: 'dist/sprat.js'
            },
			angular: {
                src: [
					'src/main/resources/js/spring/data/directives/spring-data-rest.directive.js',
					'src/main/resources/js/spring/data/directives/spring-data-rest-pagination.directive.js',
					'src/main/resources/js/spring/data/directives/spring-data-rest-sort.directive.js',
                    'src/main/resources/js/ui.angular.js',
                    'src/main/resources/js/ui/validation.angular.js',
                    'src/main/resources/js/ui/component/tree/directives/tree-open.directive.js',
                    'src/main/resources/js/ui/component/tree/directives/tree-path.directive.js',
                    'src/main/resources/js/services/batch-remove-service.js',
                ],
                dest: 'dist/sprat-angular.js'
			}
        },
        uglify: {
            options: {
                mangle: false
            },
            target :{
                files: {
                    "dist/sprat.min.js": ["dist/sprat.js"],
                    "dist/sprat-angular.min.js": ["dist/sprat-angular.js"]
                }
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-jasmine');
    grunt.loadNpmTasks('grunt-contrib-concat');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // Default task(s).
    grunt.registerTask('default', ['jshint', 'jasmine', 'concat', 'uglify']);
};