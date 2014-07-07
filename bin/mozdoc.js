#!/usr/bin/env node

var shell = require('shelljs');
var program = require('commander');
var git = require("gift");
var path = require("path");
var wintersmith = require('wintersmith');
var extend = require('extend');

var mozdocPath = './node_modules/mozdoc';
var originalPath = shell.pwd();

var mozdocResourcePaths = ['documents', 'images'];

if(!shell.test('-e', mozdocPath)) {
  console.error('  Error: Please install mozdoc npm package localy:');
  console.error('\n\tnpm install mozdoc\n');
  return;
}

program
  .version('0.0.1')
  .option('-o, --output [path]', 'directory to write build-output (defaults to ./build)')
  .option('-C, --chdir [path]', 'change the working directory')
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

var command = program.args[0];

program.output = program.output || "./build";
program.chdir = program.chdir || "./";


// Gets relevant git repo information and passes an object to the callback when // done. The callback as a signature of: callback(err, repoData).
//
// repoData structure: {
//   currentBranch: <string>,
//   branches: <gift branch object>
// }
function getRepoData(callback) {
  repo = git("./");
  repo.branch(function(err, currentBranch) {
    if(err) {
      return callback(err, null);
    }

    repo.branches(function(err, heads) {
      if(err) {
        return callback(err, null);
      }

      callback(null, {
        currentBranch: currentBranch.name,
        branches: heads
      });
    });
  });
};

function deleteTempFiles() {
  if(shell.test('-e', 'tmp/')) {
    shell.rm('-rf', 'tmp/');
  }
}

function deleteBuildFiles() {
  if(shell.test('-e', program.output)) {
    shell.rm('-rf', program.output);
  }
}

// Copies user's authored resources into our wintersmith directory.
function copyResources(src, dest) {
  for (var i = 0; i < mozdocResourcePaths.length; i++) {
    var p = path.join(src, mozdocResourcePaths[i]);
    if(shell.test('-e', p)) {
      if(p === 'documents') {
        shell.cp('-Rf', path.join(p, '*'), path.join(dest, 'contents'));
      }
      else {
        shell.cp('-Rf', path.join(p, '*'), path.join(dest, 'contents', p));
      }
    }
  }
}

function copyWintersmithSkeleton(src, dest) {
  // Do not copy over node_modules due to the size. Symlink it instead.
  var sources = shell.ls(src)
                  .filter(function(f) { return f != "node_modules" })
                  .map(function(f) { return path.join(src, f) });

  shell.cp('-Rf', sources, dest);

  var modulesSrc = path.join(src, 'node_modules');
  var modulesDest = path.join(dest, 'node_modules');
  shell.ln('-s', modulesSrc, modulesDest);
}

// Builds each branch as a static site under ./build/<branch name>.
function buildBranches(repoData, callback) {
  var branchTempPath = "./tmp/branches";

  var builds = 0;
  var onBuildComplete = function() {
    builds++;
    if(builds >= repoData.branches.length) {
      callback();
    }
  }

  for (var i = 0; i < repoData.branches.length; i++) {
    var branch = repoData.branches[i];

    var source;
    if (branch.name === repoData.currentBranch) {
      // Don't clone current branch since it's already checked out.
      source = program.chdir || "./";
    }
    else {
      source = path.join(branchTempPath, branch.name, program.chdir);
      shell.exec("git clone -b " + branch.name + " ./ " + source);
    }

    build({
      source: source,
      output: path.join(program.output, branch.name),
      wsTempPath: path.join(source, "tmp/wintersmith"),
      repoData: repoData,
      branch: branch.name,
    }, onBuildComplete);
  }
}

// Creates an HTML file which redirects to `opts.dest` and saves it in
// `opts.source`.
function createRedirect(opts) {
  var source = opts.source;
  var dest = opts.dest;

  var html = '<meta http-equiv="refresh" content="0;URL=\'' + dest + '\'" />';

  html.to(source);
}

// Builds a wintersmith static site.
function build(opts, callback) {
  var DEFAULT_OPTIONS = {
    source: './', // mozilla-doc source directory
    output: program.output, // directory to build site to
    repoData: null, // git repository info from getRepoData();
    branch: null, // Name of the branch being built, required if repoData used
    wsTemplatePath: path.join(mozdocPath, 'wintersmith'),
    wsTempPath: './tmp/wintersmith' // directory to copy wsTemplatePath to
  };
  opts = extend({}, DEFAULT_OPTIONS, opts || {});

  shell.mkdir('-p', opts.wsTempPath);

  copyWintersmithSkeleton(opts.wsTemplatePath, opts.wsTempPath);
  copyResources(opts.source, opts.wsTempPath);

  // The wintersmith template needs to know about our branches. We're going to
  // inject them into the site's config as locals.
  var configPath = path.resolve("./", path.join(opts.wsTempPath, 'config.json'));
  var config = require(configPath);
  if(opts.repoData) {
    var branches = opts.repoData.branches.map(function(b) { return b.name });

    config.locals = config.locals || {};
    config.locals.branches = branches;
    config.locals.currentBranch = opts.branch;
  }

  var env = wintersmith(config, opts.wsTempPath);
  env.build(opts.output, function(error) {
    callback(error);
  });
}

function serve(repoData, callback) {
  var env = wintersmith("./tmp/wintersmith/config.json", "./tmp/wintersmith");
  env.preview(function(error, server) {
    if (error) throw error;
    callback(error);
  });
}

if(command === 'build' || command === 'serve') {
  deleteBuildFiles();
  deleteTempFiles();

  getRepoData(function(err, repoData) {
    var onBranchesBuilt = function() {
      createRedirect({
        source: path.join(program.output, "index.html"),
        dest: repoData.currentBranch,
      });

      if(command === 'serve') {
        serve(repoData, function(err) {
          require('chokidar')
            .watch(mozdocResourcePaths, {ignored: /[\/\\]\./})
            .on('all', function(event, path) {
              console.log("event:", event, "path:", path);
              copyResources('./', './tmp/wintersmith');
            });
        });
      }
    };

    buildBranches(repoData, onBranchesBuilt);
  });
}
else if (command === 'init' || command === 'new'){
  var name = program.args[1];

  for (var i = 0; i < mozdocResourcePaths.length; i++) {
    shell.mkdir('-p', path.join(name, mozdocResourcePaths[i]));
  }

  shell.cp('wintersmith/contents/index.md', path.join(name, 'documents'));
}
else {
  console.error("  Error: '" + command + "' is not a valid command");
  program.help();
}
