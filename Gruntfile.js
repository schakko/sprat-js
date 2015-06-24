module.exports = function( grunt ) {
	"use strict";
	
	var dirs = ["dist/**/*.js", "test/**/*.js"];
	
	grunt.initConfig({
		lint: { 
			files: dirs
		},
		qunit: {
			files: ["test/**/*.tests.html"]
		},
		jshint: { 
			files: dirs
		}
	});
	
	// Load the plugin that provides the "uglify" task.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');

  // Default task(s).
  grunt.registerTask('default', ['jshint', 'qunit']);
}