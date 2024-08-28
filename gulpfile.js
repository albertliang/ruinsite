
var gulp = require('gulp');
var ts = require('gulp-typescript');
var tslint = require('gulp-tslint');
var sourcemaps = require('gulp-sourcemaps');
var mocha = require('gulp-mocha');
var server = require('gulp-express');

gulp.task('build', ['typescript-server','copysourcetobuild']);
gulp.task('test', ['test-setup', 'test-server']);
gulp.task('default', ['typescript-server', 'watch', 'server']);

//compile typescript to javascript
gulp.task('typescript-server', function () {
	return gulp
    	.src('./src/server/**/*.ts' || './src/server/*.ts')
        .pipe(sourcemaps.init())
		.pipe(ts({ 
			noImplicitAny: true, 
      removeComments: true,
			moduleResolution: 'node', 
			module: 'commonjs',
			target: 'ES5'
			}))
        //writes sourcemap to the same .js file locations for typescript debugging
        .pipe(sourcemaps.write('.', { 
            includeContent: false,
            sourceRoot: function(file){return file.base;}})) 
		.pipe(gulp.dest('./build/server'));
});

//watch for typescript changes
gulp.task('watch', ['typescript-server'], function() {
    gulp.watch(['src/server/**/*.ts'], ['typescript-server','tslint']);
    gulp.watch(['!src/server/**/*.ts'], ['copysourcetobuild']);
});

gulp.task('copysourcetobuild', function() {
    return gulp
    	.src('src/server/**/*.{js,json,html}')
        .pipe(gulp.dest('./build/server'))
});

//typescript lint
gulp.task("tslint", function() {
    return gulp.src(["src/server/**/**.ts"])
    .pipe(tslint({ }))
    .pipe(tslint.report("verbose"));
});

//mocha test scripts
gulp.task('test-setup', function () {
    process.env.NODE_ENV = "test";
	require('./build/server/server');
});

gulp.task('test-server', function () {
	return gulp.src('./build/server/**/*.test.js', {read:false})
		.pipe(mocha())
		// .once('error', function () {
		// 	process.exit(1);
		// })
		.once('end', function () {
			process.exit();
		});
});

//*** not used at the moment ***
gulp.task('typescript-client', function () {
	return gulp
    	.src('./src/client/**/*.ts')
		.pipe(ts({ noImplicitAny: true }))
		.pipe(gulp.dest('./release/client/'));
});

//run server
gulp.task('server', function () {    
    server.run(['build/server/server.js']); // Start the server at the beginning of the task 
    gulp.watch(['build/server/**/*.js'], server.run); //restart express on change
    gulp.watch(['build/server/views/*.jade'], server.notify); //refresh browser on view change
});
