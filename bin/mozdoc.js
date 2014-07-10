#!/usr/bin/env node

var shell = require('shelljs');
var program = require('commander');
var git = require("gift");
var path = require("path");
var wintersmith = require('wintersmith');
var extend = require('extend');
var gulp = require('gulp');
var gutil = require('gulp-util');
var deploy = require("gulp-gh-pages");
var request = require("request");
var prompt = require('prompt');

var mozdocPath = './node_modules/mozdoc';
if(shell.test('-e', './bin/mozdoc.js')) {
  // We are running from the mozdoc directory.
  mozdocPath = "./";
}

var mozdocCentralUrl = 'http://tsatsk.in:3000/doc/register';

var mozdocResourcePaths = ['documents', 'images', 'css', 'js', 'prototypes'];

program
  .version('0.0.1')
  .option('-o, --output [path]', 'directory to write build-output (defaults to ./build)')
  .option('-C, --chdir [path]', 'change the working directory')
  .option('-s, --skip-registration', 'skip registration with Mozilla Docs Central')
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

function requireMozDoc() {
  if(!shell.test('-e', mozdocPath)) {
    console.error('  Error: Please install mozdoc npm package localy:');
    console.error('\n\tnpm install mozdoc\n');
    process.exit(1);
  }
}


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

      repo.config(function(err, config) {
        callback(null, {
          currentBranch: currentBranch.name,
          branches: heads,
          originUrl: config.items['remote.origin.url']
        });
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
function copyResources(src, wsPath) {
  // Folder names defined in mozdocResourcePaths will be copied in the
  // wintersmith (ws) contents folder. For example "images/" in the user's
  // mozdoc folder will be copied to "wintersmith/contents/images/".
  // One exception to this is "documents/". Its contents will be copied to the
  // root of "wintersmith/contents/".

  for (var i = 0; i < mozdocResourcePaths.length; i++) {
    var srcDir = path.join(src, mozdocResourcePaths[i]);
    if(shell.test('-e', srcDir)) {
      if(srcDir === path.join(src, 'documents')) {
        // Copy "documents/" to "contents/" instead of "contents/documents".
        shell.cp('-Rf', path.join(srcDir, '*'), path.join(wsPath, 'contents'));
      }
      else {
        shell.cp(
                  '-Rf',
                  path.join(srcDir, '*'),
                  path.join(wsPath, 'contents', mozdocResourcePaths[i])
                );
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
      source = program.chdir;
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

function ghPagesUrl(remoteUrl) {
  var segments = remoteUrl.split('/');
  var length = segments.length;

  // Removes ssh info if applicible
  var user = segments[length-2].replace(/^.*\:/, "");

  // Removes trailing ".git" if applicible
  var repoName = segments[length-1].replace(/\.git$/, "");

  return "http://" + user + ".github.io/" + repoName;
}

// Builds a wintersmith static site.
function build(opts, callback) {
  var DEFAULT_OPTIONS = {
    source: program.chdir, // mozilla-doc source directory
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
  var wsConfigPath = path.resolve("./", path.join(opts.wsTempPath, 'config.json'));
  var wsConfig = require(wsConfigPath);
  if(opts.repoData) {
    var branches = opts.repoData.branches.map(function(b) { return b.name });

    wsConfig.locals = wsConfig.locals || {};
    wsConfig.locals.branches = branches;
    wsConfig.locals.currentBranch = opts.branch;
  }

  var env = wintersmith(wsConfig, opts.wsTempPath);
  env.build(opts.output, function(error) {
    callback(error);
  });
}

function serve(repoData, callback) {
  var wsPath = path.join(program.chdir, 'tmp/wintersmith');
  var env = wintersmith(path.join(wsPath, 'config.json'), wsPath);
  env.preview(function(error, server) {
    if (error) throw error;
    callback(error);
  });
}

gulp.task('build', function(callback) {
  requireMozDoc();

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
              copyResources(program.chdir, './tmp/wintersmith');
            });
        });
      }

      callback();
    };

    buildBranches(repoData, onBranchesBuilt);
  });
});

gulp.task('register', function(callback) {
  if(program.skipRegistration) {
    callback();
    return;
  }

  var config = require(path.resolve('./', path.join(program.chdir, 'config.json')));

  getRepoData(function(err, repoData) {
    if(err) gutil.log("Error retrieving repo data: ", err);
    request.post({
        method: 'post',
        uri: mozdocCentralUrl,
        json: true,
        body: {
          config: config,
          github_remote: repoData.originUrl
        }
      },
      function (err, response, body) {
        if(err) {
          gutil.log("Could not register doc with Mozilla Docs Central.");
          gutil.log("Request error: ");
          gutil.log(err);
        }
        callback();
      }
    );
  });
});

gulp.task('publish', ['build', 'register'], function(callback) {
  getRepoData(function(err, repoData) {
    if(typeof repoData.originUrl === 'undefined') {
      gutil.log("Error: It appears you have published this doc to Github yet.");
      gutil.log("");
      gutil.log("Please go to https://github.com/new and create a new repository.");
      gutil.log("Once you have created a repository, please follow the \"Push an existing repository from the command line\" section.");
      callback();
      return;
    }

    var stream = gulp.src(path.join(program.output, "**/*"))
                  .pipe(deploy())
                  .on('end', function() {
                    var ghPagesUrl = ghPagesUrl(repoData.originUrl);
                    gutil.log("");
                    gutil.log("Your doc has been successfully published \o/");
                    gutil.log("You can find it at", ghPagesUrl);

                    callback();
                  });
  });
});

if(command === 'build' || command === 'serve') {
  gulp.start("build");
}
else if (command === 'init' || command === 'new'){
  var name = program.args[1];

  for (var i = 0; i < mozdocResourcePaths.length; i++) {
    shell.mkdir('-p', path.join(name, mozdocResourcePaths[i]));
  }

  shell.cd(name);

  // Build up a config.json for our mozdoc from user input.
  prompt.start();
  prompt.get(['name', 'product', 'component'], function (err, result) {
    var newConfig = {
      name: result.name,
      product: result.product,
      component: result.component
    }

    JSON.stringify(newConfig, null, 2).to('config.json');

    shell.exec('npm link mozdoc');

    shell.cp(path.join(mozdocPath, 'wintersmith/contents/index.md'), 'documents');

    var ignore = ".DS_Store\nbuild\ntmp\nnode_modules";
    ignore.to('.gitignore');
    shell.exec('git init .');
    shell.exec('git add .');
    shell.exec('git commit -am "initial commit"');

    var docPath = path.resolve("./");
    gutil.log("");
    gutil.log("Your new Mozilla Doc has been created in:");
    gutil.log("  ", docPath);
  });
}
else if(command === 'publish') {
  gulp.start("publish");
}
else {
  console.error("  Error: '" + command + "' is not a valid command");
  program.help();
}
