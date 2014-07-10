var gulp = require('gulp');
var shell = require('shelljs');

gulp.task('docs', function() {
  shell.exec("bin/mozdoc.js build -o doc -C doc_source");
});

gulp.task('docs-serve', function() {
  shell.exec("bin/mozdoc.js serve -o doc -C doc_source");
});

gulp.task('docs-publish', function() {
  shell.exec("bin/mozdoc.js publish --skip-registration -C doc_source -o doc");
});
