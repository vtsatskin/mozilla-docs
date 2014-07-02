#!/usr/bin/env node

var shell = require('shelljs');
var program = require('commander');
var git = require("gift");
var path = require("path");

var command = process.argv[2];
var wintersmithPath = './node_modules/mozdoc';
var originalPath = shell.pwd();

if(!shell.test('-e', wintersmithPath)) {
  console.error('  Error: Please install mozdoc npm package localy:');
  console.error('\n\tnpm install mozdoc\n');
  return;
}

program
  .version('0.0.1')
  .usage('[command]');

program.on('--help', function() {
  console.log('  Commands:');
  console.log('');
  console.log('    build: generates a static site in ./build');
  console.log('    serve: serves site on http://localhost:8080');
  console.log('');
  console.log('  Examples:');
  console.log('');
  console.log('    $ wintersmith build');
  console.log('    $ wintersmith serve');
  console.log('');
});

program.parse(process.argv);

function deleteTempFiles() {
  if(shell.test('-e', 'tmp/')) {
    shell.rm('-rf', 'tmp/');
  }
}

function copyResources(src, dest) {
  // Copies user's authored resources into our wintersmith directory.

  var copyPaths = ['documents', 'images'];

  for (var i = 0; i < copyPaths.length; i++) {
    var p = path.join(src, copyPaths[i], '*');
    if(shell.test('-e', p)) {
      shell.cp('-Rf', p, path.join(dest, 'contents'));
    }
  }
}

function buildBranches() {
  var branchTempPath = "./tmp/branches";

  repo = git("./");
  repo.branch(function(err, currentBranch) {
    repo.branches(function(err, heads) {
      for (var i = 0; i < heads.length; i++) {
        var branch = heads[i];

        if(branch.name === currentBranch.name) {
          // Don't clone current branch
          continue;
        }

        var dest = path.join(branchTempPath, branch.name);

        shell.exec("git clone -b " + branch.name + " ./ " + dest);

        build({
          source: dest,
          output: path.join("build", branch.name),
          wsTempPath: path.join(dest, "tmp/wintersmith")
        });
      }
    });
  });
}

function build(opts) {
  var opts = opts || {};
  var wsTemplatePath = opts.wsTemplatePath
                      || "./node_modules/mozdoc/wintersmith/*";
  var source = opts.source || "./";
  var output = path.resolve("./", opts.output || "build");
  var wsTempPath = opts.wsTempPath || "./tmp/wintersmith";

  shell.mkdir('-p', wsTempPath);

  shell.cp('-Rf', wsTemplatePath, wsTempPath);
  copyResources(source, wsTempPath);

  shell.exec('wintersmith build '
            + '--chdir "' + wsTempPath + '" '
            + '-X --output ' + output);
}

if(command == 'build') {
  deleteTempFiles();
  build();
  buildBranches();
}
else if(command == 'serve') {
  require('chokidar')
    .watch('./documents/', {ignored: /[\/\\]\./})
    .on('all', function(event, path) {
      copyResources();
    });

  // Wintersmith should be run aysnc or it will block our file watcher
  shell.exec('wintersmith preview '
            + '--chdir "'+ wintersmithPath + '" '
            + '--output "' + originalPath + '/build"',
            { async:true });
}
else {
  console.error("  Error: '" + command + "' is not a valid command");
  program.help();
}
