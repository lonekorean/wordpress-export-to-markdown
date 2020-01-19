# wordpress-export-to-markdown

A script that converts a WordPress export XML file into Markdown files suitable for a static site generator ([Gatsby](https://www.gatsbyjs.org/), [Hugo](https://gohugo.io/), [Jekyll](https://jekyllrb.com/), etc.).

Each post is saved as a separate Markdown file with appropriate frontmatter. Images are also downloaded and saved. Embedded content from YouTube, Twitter, CodePen, etc. is carefully preserved.

![wordpress-export-to-markdown running in a terminal](https://user-images.githubusercontent.com/1245573/72686026-3aa04280-3abe-11ea-92c1-d756a24657dd.gif)

## Quick Start

You'll need:
- [Node.js](https://nodejs.org/) v12.14 or later
- Your [WordPress export file](https://wordpress.org/support/article/tools-export-screen/)

It is recommended that you drop your WordPress export file into the same directory that you run this script from so it's easy to find.

You can run this script immediately in your terminal with `npx`:

```
npx wordpress-export-to-markdown
```

Or you can clone and run (this makes repeated runs faster and allows you to tinker with the code). After cloning this repo, open your terminal to the package's directory and run:

```
npm install && node index.js
```

Either way you run it, the script will start the wizard. Answer the questions and off you go!

## Command Line

The wizard makes it easy to configure your options, but you can also do so via the command line if you want. For example, the following will give you [Jekyll](https://jekyllrb.com/)-style output in terms of folder structure and filenames.

Using `npx`:

```
npx wordpress-export-to-markdown --post-folders=false --prefix-date=true
```

Using a locally cloned repo:

```
node index.js --post-folders=false --prefix-date=true
```

The wizard will still ask you about any options not specifed on the command line. To skip the wizard entirely and use default values for unspecified options, add `--wizard=false`.

## Options

### Use wizard?

- Argument: `--wizard`
- Type: `boolean`
- Default: `true`

Enable to have the script prompt you for each option. Disable to skip the wizard and use default values for any options not specified via the command line.

### Path to WordPress export file?

- Argument: `--input`
- Type: `file` (as a path string)
- Default: `export.xml`

The path to the WordPress export file that you want to parse. It is recommended that you drop your WordPress export file into the same directory that you run this script from so it's easy to find.

### Path to output folder?

- Argument: `--output`
- Type: `folder` (as a path string)
- Default: `output`

The path to the output directory where Markdown and image files will be saved. If it does not exist, it will be created for you.

### Create year folders?

- Argument: `--year-folders`
- Type: `boolean`
- Default: `false`

Whether or not to organize output files into folders by year.

### Create month folders?

- Argument: `--month-folders`
- Type: `boolean`
- Default: `false`

Whether or not to organize output files into folders by month. You'll probably want to combine this with `--year-folders` to organize files by year then month.

### Create a folder for each post?

- Argument: `--post-folders`
- Type: `boolean`
- Default: `true`

Whether or not to save files and images into post folders.

If `true`, the post slug is used for the folder name and the post's Markdown file is named `index.md`. Each post folder will have its own `/images` folder.

    /first-post
        /images
            potato.png
        index.md
    /second-post
        /images
            carrot.jpg
            celery.jpg
        index.md

If `false`, the post slug is used to name the post's Markdown file. These files will be side-by-side and images will go into a shared `/images` folder.

    /images
        carrot.jpg
        celery.jpg
        potato.png
    first-post.md
    second-post.md

Either way, this can be combined with with `--year-folders` and `--month-folders`, in which case the above output will be organized under the appropriate year and month folders.

### Prefix post folders/files with date?

- Argument: `--prefix-date`
- Type: `boolean`
- Default: `false`

Whether or not to prepend the post date to the post slug when naming a post's folder or file.

If `--post-folders` is `true`, this affects the folder.

    /2019-10-14-first-post
        index.md
    /2019-10-23-second-post
        index.md

If `--post-folders` is `false`, this affects the file.

    2019-10-14-first-post.md
    2019-10-23-second-post.md

### Save images attached to posts?

- Argument: `--save-attached-images`
- Type: `boolean`
- Default: `true`

Whether or not to download and save images attached to posts. Generally speaking, these are images that were uploaded by using **Add Media** or **Set Featured Image** when editing a post in WordPress. Images are saved into `/images`.

### Save images scraped from post body content?

- Argument: `--save-scraped-images`
- Type: `boolean`
- Default: `true`

Whether or not to download and save images scraped from &lt;img&gt; tags in post body content. Images are saved into `/images`. The &lt;img&gt; tags are updated to point to where the images are saved.
