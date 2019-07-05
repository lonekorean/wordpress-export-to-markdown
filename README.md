# wordpress-export-to-markdown

Converts a WordPress export XML file into Markdown files.

Useful if you want to migrate from WordPress to a static site generator ([Gatsby](https://www.gatsbyjs.org/), [Hugo](https://gohugo.io/), [Jekyll](https://jekyllrb.com/), etc.).

Saves each post as a separate file with appropriate frontmatter. Also saves attached images and (optionally) any additional images found in post body content. Posts and images can be saved into a variety of folder structures.

## Quick Start

You'll need:
- [Node.js](https://nodejs.org/) v10.12 or later
- Your [WordPress export file](https://codex.wordpress.org/Tools_Export_Screen)

Open your terminal to this package's directory. Run `npm install` and then `node index.js`.

This will create an `/output` folder filled with your posts and images.

## Customization

You can use command line arguments to control options for how the script runs. For example, this will give you [Jekyll](https://jekyllrb.com/)-style output in terms of folder structure and filenames:

```
node index.js --postfolders=false --prefixdate=true
```

### --input

- Type: String
- Default: `export.xml`

The file to parse. This should be the WordPress export XML file that you downloaded.

### --output

- Type: String
- Default: `output`

The output directory where Markdown and image files will be saved.

### --yearmonthfolders

- Type: Boolean
- Default: `false`

Whether or not to organize output files into year and month folders.

    /output
        /2017
            /01
            /02
        /2018
            /01

### --yearfolders

- Type: Boolean
- Default: `false`

Whether or not to organize output files into year folders.

    /output
        /2017
        /2018

### --postfolders

- Type: Boolean
- Default: `true`

Whether or not to save files and images into post folders.

If `true`, the post slug is used for the folder name and the post's Markdown file is named `index.md`. Each post folder will have its own `/images` folder.

    /output
        /first-post
            /images
                potato.png
            index.md
        /oh-look-another-post
            /images
                cat1.gif
                cat2.gif
            index.md

If `false`, the post slug is used to name the post's Markdown file. These files will be side-by-side and images will go into a shared `/images` folder.

    /output
        /images
            cat1.gif
            cat2.gif
            potato.png
        first-post.md
        oh-look-another-post.md

Either way, this can be combined with with `--yearmonthfolderes` and `--yearfolders`, in which case the above output will be organized under the appropriate year and month folders.

### --prefixdate

- Type: Boolean
- Default: `false`

Whether or not to prepend the post date to the post slug when naming a post's folder or file.

If `--postfolders` is `true`, this affects the folder.

    /output
        /2017-01-14-first-post
            index.md
        /2017-01-23-oh-look-another-post
            index.md

If `--postfolders` is `false`, this affects the file.

    /output
        2017-01-14-first-post.md
        2017-01-23-oh-look-another-post.md

### --saveimages

- Type: Boolean
- Default: `true`

Whether or not to download and save images attached to posts. Generally speaking, these are images that were added by dragging/dropping or clicking **Add Media** or **Set Featured Image** when editing a post in WordPress. Images are saved into `/images`. See `--postfolders` for more details.

### --addcontentimages

- Type: Boolean
- Default: `false`

Whether or not to also include images scraped from &lt;img&gt; tags in post body content. These images are downloaded and saved along with other images as dictated by `--saveimages`. The &lt;img&gt; tags are updated to point to where the images are saved.

### --categoriestotags

- Type: Boolean
- Default: `false`

Whether or not to treat category names as tags and lump both together in the frontmatter as `tags`.
