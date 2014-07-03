#!/usr/bin/env node

var shell = require('shelljs');
var program = require('commander');
var git = require("gift");
var path = require("path");
var wintersmith = require('wintersmith');

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
  if(shell.test('-e', 'build/')) {
    shell.rm('-rf', 'build/');
  }
}

// Copies user's authored resources into our wintersmith directory.
function copyResources(src, dest) {
  var copyPaths = ['documents', 'images'];

  for (var i = 0; i < copyPaths.length; i++) {
    var p = path.join(src, copyPaths[i]);
    if(shell.test('-e', p)) {
      shell.cp('-Rf', path.join(p, '*'), path.join(dest, 'contents'));
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
function buildBranches(repoData) {
  var branchTempPath = "./tmp/branches";

  for (var i = 0; i < repoData.branches.length; i++) {
    var branch = repoData.branches[i];

    var source;
    if (branch.name === repoData.currentBranch) {
      // Don't clone current branch since it's already checked out.
      source = "./";
    }
    else {
      source = path.join(branchTempPath, branch.name);
      shell.exec("git clone -b " + branch.name + " ./ " + source);
    }

    build({
      source: source,
      output: path.join("build", branch.name),
      wsTempPath: path.join(source, "tmp/wintersmith"),
      repoData: repoData,
      branch: branch.name
    });
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
function build(opts) {
  var opts = opts || {};
  var wsTemplatePath = opts.wsTemplatePath
                      || "./node_modules/mozdoc/wintersmith/";
  var source = opts.source || "./";
  var output = path.resolve("./", opts.output || "build");
  var repoData = opts.repoData || null;
  var branch = opts.branch || null;
  var wsTempPath = opts.wsTempPath || "./tmp/wintersmith";

  shell.mkdir('-p', wsTempPath);

  copyWintersmithSkeleton(wsTemplatePath, wsTempPath);
  copyResources(source, wsTempPath);

  // The wintersmith template needs to know about our branches. We're going to
  // inject them into the site's config as locals.
  var configPath = path.resolve("./", path.join(wsTempPath, 'config.json'));
  var config = require(configPath);
  if(repoData) {
    var branches = repoData.branches.map(function(b) { return b.name });

    config.locals = config.locals || {};
    config.locals.branches = branches;
    config.locals.currentBranch = branch;
  }

  var env = wintersmith(config, wsTempPath);
  env.build(output, function(error) {
    if (error) throw error;
  });
}

if(command == 'build') {
  deleteBuildFiles();
  deleteTempFiles();

  getRepoData(function(err, repoData) {
    buildBranches(repoData);

    // Wintersmith building is asynchronous so we can't be guaranteed the build
    // path has been created yet. Create it now if needed.
    if (!shell.test('-e', './build')) {
      shell.mkdir('-p', './build');
    }

    createRedirect({
      source: "./build/index.html",
      dest: repoData.currentBranch,
    });
  });
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
