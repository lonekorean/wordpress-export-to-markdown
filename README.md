# wordpress-export-to-markdown

Converts a WordPress export XML file into Markdown files. Useful if you want to migrate from WordPress to a static site generator ([Gatsby](https://www.gatsbyjs.org/), [Hugo](https://gohugo.io/), [Jekyll](https://jekyllrb.com/), etc.).

Saves each post as a separate file with appropriate frontmatter. Also downloads and saves images. There are several options for controlling the folder structure of the output.

## Quick Start

You'll need:
- [Node.js](https://nodejs.org/) v12.14 or later
- Your [WordPress export file](https://codex.wordpress.org/Tools_Export_Screen)

Open your terminal to this package's directory. Run `npm install` and then `node index.js`. This will start the wizard. Answers the prompts and off you go!

## Command Line

The wizard makes it easy to configure your options, but you can also do so via the command line if you want.

For example, this will give you [Jekyll](https://jekyllrb.com/)-style output in terms of folder structure and filenames:

```
node index.js --postfolders=false --prefixdate=true
```

The wizard will still prompt you for any options not specifed on the command line. To skip the wizard entirely and use default values for unspecified options, use `--wizard=false`, like this:

```
node index.js --wizard=false --postfolders=false --prefixdate=true
```

You can see available command line arguments by running:

```
node index.js -h
```

## Options

### Use wizard?

- Argument: `--wizard`
- Type: `boolean`
- Default: `true`

Enable to have the script prompt you for each option. Disable to skip the wizard entirely and use default values for any options not specified via the command line.

### Path to input file?

- Argument: `--input`
- Type: `file` (as a path string)
- Default: `export.xml`

The file to parse. This should be the WordPress export XML file that you downloaded.

### Path to output folder?

- Argument: `--output`
- Type: `folder` (as a path string)
- Default: `output`

The output directory where Markdown and image files will be saved. If it does not exist, it will be created for you.

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

Whether or not to download and save images attached to posts. Generally speaking, these are images that were added by dragging/dropping or clicking **Add Media** or **Set Featured Image** when editing a post in WordPress. Images are saved into `/images`.

### Save images scraped from post body content?

- Argument: `--save-scraped-images`
- Type: `boolean`
- Default: `true`

Whether or not to download and save images scraped from &lt;img&gt; tags in post body content. Images are saved into `/images`. The &lt;img&gt; tags are updated to point to where the images are saved.
