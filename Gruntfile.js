module.exports = function( grunt ) {
	"use strict";
	
	var dirs = ["dist/**/*.js", "test/**/*.js"];
	
	grunt.initConfig({
		qunit: {
			files: ["test/**/*.tests.html"]
		},
		jshint: { 
			files: dirs
		},
		concat: {
			dist: {
				src: [
					'vendor/jsonselect.js',
					'dist/app.js', 
					'dist/path.js',
					'dist/security.js',
					'dist/wrestle.js',
					'dist/ui/core.js',
					'dist/datetime.js',
					'dist/navigation.js',
					'dist/renderer.js',
					'dist/validation.js'
				],
				dest: 'sprat.js'
			}
		},
		uglify: {
			options: {
				mangle: false
			},
			target :{
				files: {
					"sprat.min.js": ["sprat.js"]
				}
			}
		}
	});
	
	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-concat');
	grunt.loadNpmTasks('grunt-contrib-uglify');

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'qunit', 'concat', 'uglify']);
}