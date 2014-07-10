---
title: Mozilla Docs Documentation
template: index.jade
---

## Overview

This is a template for creating beautiful docs, easily.

## Installation

This guide assumes you are running on a relatively recent version of Mac OS X
and you are at least some-what comfortable with running git commands.

### Github Client

Although not absolutely necessary to use Mozilla Docs, the Github client makes
working with git easier. Plus it takes care of installing git for you.

So go ahead and grab a copy of the Github client from https://mac.github.com/.
Make sure you run the app at least once to install the `git` command.

### Node

To actually run Mozilla Docs, you will need to install node. You can grab a copy
from http://nodejs.org/.

### Mozilla Docs

Once you have installed both git and node, we can now install Mozilla Docs.
Open your Terminal (*Applications* > *Utilities* > *Terminal.app*) and type the
following command

    npm install -g git+https://git@github.com/vtsatskin/mozilla-docs.git

If nothing yelled at you, congradulations! You've successfully installed Mozilla
Docs \o/

### Atom (optional)

The Atom text editor is recommend for editing Mozilla Docs. You can get it from
https://atom.io/

## Your First Project

### Creating a Mozilla Doc

Open up your Terminal and change into a directory where you want your Mozilla
Doc to live. For example, if you want to use your Documents directory you would
type the following command

    cd ~/Documents

You can pick any directory, so don't worry if you don't want to use Documents.

Let's create a new Mozilla Doc. You'll want to use the `mozdoc new <directory>`
command. Instead of *&lt;directory&gt;*, put in a folder name (without spaces!)
you would like to use.

    mozdoc new my-new-doc

If you can't think of one *my-first-doc* should be an adequate one.

You should see a prompt asking you for various meta data about your document.
Once you've answered all the questions, the new document should be all ready.
You should see an output similar to this

    [15:38:16] Your new Mozilla Doc has been created in:
    [15:38:16]    /Users/vt/Documents/my-new-doc

If nothing yelled at you, congradulations! You've successfully created your
first Mozilla Doc \o/


### Viewing your lovely Mozilla Doc

Go ahead and step into the directory created previously by `mozdoc` with

    cd my-new-doc

Viewing your Mozilla Doc is quite painless, all you have to do is run the
following command

    mozdoc serve

Then go to http://localhost:8080/ in your web browser.

### Editing your lovely Mozilla Doc

It's time to write some documents! Go ahead and open your Mozilla Doc's folder
in your favourite text editor. If you've installed Atom, you can open it with
one command

    atom

Open up `documents/index.md`. Changes to this file will show up
**automatically** on the website. So try changing some words around and see how http://localhost:8080/ updates automatically.

Cool huh!

Let's try inserting an image. Everyone at Mozilla loves Red Pandas, after all
**it's the law**. Go ahead and save the following cute Firefox into your `images` folder.

![](images/red-panda.jpg)

If you want to insert an image, use the following syntax

    ![](images/red-panda.jpg)

Save your changes and check out your site. A wild red panda appears, fuck yeah.

### Committing your changes

Tired of having to keep track of all your changes with files such as `design_rev36.jpg`? Version control to the rescue!

With git, you can track what files have changed and incrementally *commit* your changes. It allows you to have a nice history of all the changes to your design.

Open up with Github client with the following command

    github

You'll see something among the lines of this:

**TODO: insert image**

You should be able to review the changes you've made. When you're ready fill in
the *summary* field. Something informative like *added cute red panda* should
suffice. Remember, you want to be able to get a good idea of what the changes
were just by the commit message.

Press the *commit* button to save your changes. You can press the *Publish*
button in the top-right of the app to make sure your changes are synced to
Github.

### Publishing

You've worked hard on your document. You made sure to please the Mozilla Gods
with your cute red panda antiques. Your document is sure to impress!

"But how do I share this??" you might ask. Have no fear, that's why Mozilla Docs
has a `publish` command. Try it out

    mozdoc publish

Lots of magic happens here, but now you can find your lovely document at the
following url

    http://<github user>.github.io/<doc name>

Whenever you've got changes you want to share, just run the publish command the
`mozdoc` will take care of the rest!

### Branching

**TODO: how do branch**
