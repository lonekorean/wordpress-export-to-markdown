# wordpress-export-to-markdown

Converts a WordPress export XML file into Markdown files. This makes it easy to migrate from WordPress to a static site generator ([Eleventy](https://www.11ty.dev/), [Gatsby](https://www.gatsbyjs.com/), [Hugo](https://gohugo.io/), etc.).

![wordpress-export-to-markdown running in a terminal](https://github.com/user-attachments/assets/7ac1aa07-b6ee-46f4-ab49-291c1c45f350)

## Features

- Saves each post as a separate Markdown file with frontmatter.
- Also saves drafts, pages, and custom post types, if you have any.
- Downloads images and updates references to them.
- User-friendly wizard guides you through the process.
- Lots of command line options for configuration, if needed.

## Quick Start

You'll need:

- [Node.js](https://nodejs.org/) installed.
- Your [WordPress export file](https://wordpress.org/support/article/tools-export-screen/). Be sure to export "All Content".

Then run this in your terminal:

```
npx wordpress-export-to-markdown
```

## Options

The script will start with a wizard to ask you a few questions.

Optionally, you can provide answers to any of these questions via command line arguments, in which case the wizard will skip asking those questions. Here's an example:

```
npx wordpress-export-to-markdown --post-folders=false --prefix-date=true
```

The questions are given below, including a snippet for each one showing its command line argument set to its default value.

### Path to WordPress export file?

```
--input=export.xml
```

The path to your [WordPress export file](https://wordpress.org/documentation/article/tools-export-screen/). To make things easier, you can rename it to `export.xml` and drop it into the same directory that you run the script from.

Allowed values:

- Any path to a file that exists.

### Put each post into its own folder?

```
--post-folders=true
```

Whether or not to create a separate folder for each post's Markdown file (and images).

Allowed values:

- `true` - A folder is created for each post, with an `index.md` file and `/images` folder within. The post slug is used to name the folder.
- `false` - The post slug is used to name each post's Markdown file. These files are all saved in the same folder. All images are saved in a shared `/images` folder.

### Add date prefix to posts?

```
--prefix-date=false
```

Whether or not to prepend the post date when naming a post's folder or file.

Allowed values:

- `true` - Prepend the date, in the format `<year>-<month>-<day>`. Nothing will be prepended if there is no date (for example, an undated draft post).
- `false` - Don't prepend the date.

### Organize posts into date folders?

```
--date-folders=none
```

If and how output is organized into folders based on date.

Allowed values:

- `year` - Output is organized into folders by year. This won't happen for posts with no date (for example, an undated draft post).
- `year‑month` - Output is organized into folders by year, then into nested folders by month. Again, for posts with no date, this won't happen.
- `none` - No date folders are created.

### Save images?

```
--save-images=all
```

Which images you want to download and save.

Allowed values:

- `attached` - Save images attached to posts. Generally speaking, these are images that were uploaded by using **Add Media** or **Set Featured Image** in WordPress.
- `scraped` - Save images scraped from `<img>` tags in post body content. The `<img>` tags are updated to point to where the images are saved.
- `all` - Save all images, essentially the results of `attached` and `scraped` combined.
- `none` - Don't save any images.

## Advanced Options

These are not included in the wizard, so you'll need to set them on the command line.

### Use wizard?

```
--wizard=true
```

Whether or not to use the wizard.

Allowed values:

- `true` - The script will start with a wizard to ask five questions (the ones from the [Options](#options) section) minus any that were answered on the command line.
- `false` - Skip wizard. Options set via command line are taken, while the rest have their default values used.

### Path to output folder?

```
--output=output
```

The path to the output folder where files will be saved. It'll be created if it doesn't exist. Existing files there won't be overwritten and won't be downloaded again. This lets you resume progress by restarting the script, if it was previously terminated early. To start clean, delete the output folder.

Allowed values:

- Any valid folder path.

### Frontmatter fields?

```
--frontmatter-fields=title,date,categories,tags,coverImage,draft
```

Comma separated list of the frontmatter fields to include in Markdown files. Order is preserved. If a post doesn't have a value for a field, it is left off.

Allowed values:

- A comma separated list with any of the following: `author`, `categories`, `coverImage`, `date`, `draft`, `excerpt`, `id`, `slug`, `tags`, `title`, `type`. You can rename a field by appending `:` and the alias to use. For example, `date:created` will rename `date` to `created`.

### Frontmatter meta

```
--frontmatter-meta=rank_math_seo_score:seo_score,rank_math_contentai_score
```

Comma separated list of the WP post meta values to include in the frontmatter of Markdown files. Serialized PHP arrays get unserialized and converted to corresponding YAML structures.

### Append WP post meta to Content

```
--append-meta=staff_sidebar:sidebar
```

Extract listed WP post meta and append it to content using MDC component syntax.

e.g.
```
::sidebar
WP meta content from 'staff_sidebar' post meta key converted to markdown
::
```

### Specific content types

```
--post-types=post,page
```

Comma separated list of the content types to include in Markdown files. Leave empty to include all default content types.

Allowed values:

- A comma separated list: `post`, `page`, etc.

### Exclude specific content types

```
--exclude-post-types=nf_sub,et_pb_layout,acf-post-type,acf-field,acf-field-group,rm_content_editor,rank_math_schema
```

Comma separated list of the content types to exclude from Markdown files. Leave empty to include all default content types.

### Strip shortcodes

```
--strip-shortcodes=true
```

Strip shortcodes from content converting the content therein into simple <div> tags.

Allowed values:

- `true` or `false`.

### Delay between image file requests?

```
--request-delay=500
```

Time (in milliseconds) to wait between requesting image files. Increasing this might help if you see timeouts or server errors.

Allowed values:

- Any positive integer.

### Delay between writing markdown files?

```
--write-delay=10
```

Time (in milliseconds) to wait between saving Markdown files. Increasing this might help if your file system becomes overloaded.

Allowed values:

- Any positive integer.

### Timezone to apply to date?

```
--timezone=utc
```

The timezone applied to post dates.

Allowed values:

- Any valid timezone as [specified here](https://moment.github.io/luxon/#/zones?id=specifying-a-zone).

### Include time with frontmatter date?

```
--include-time=false
```

Whether or not time should be included with the date in frontmatter.

Allowed values:

- `true` - Time is included using an ISO 8601-compliant format. For example, `2020-12-25T11:20:35.000Z`.
- `false` - Time is not included. For example, `2020-12-25`.

### Frontmatter date format string?

```
--date-format=""
```

A custom formatting string to apply to frontmatter dates. If set, takes precedence over `--include-time`. An empty string (the default) is ignored, resulting in the basic `<year>-<month>-<day>` format.

Allowed values:

- Any valid custom formatting string. See [this table of tokens](https://moment.github.io/luxon/#/parsing?id=table-of-tokens).

### Wrap frontmatter date in quotes?

```
--quote-date=false
```

Whether or not to put double quotes around the date when writing it to frontmatter.

Allowed values:

- `true` - Adds double quotes. This technically turns the date into a string value.
- `false` - Doesn't add double quotes.

### Use strict SSL?

```
--strict-ssl=true
```

Whether or not to use strict SSL when downloading images.

Allowed values:

- `true` - Use strict SSL. This is the safer option.
- `false` - Don't use strict SSL. This will let you avoid the "self-signed certificate" error when working with a self-signed server. Just make sure you know what you're doing.

## Local Development

You can install and run this script locally if you want to tinker with it:

1. `git clone` this repo.
2. `cd` into the repo directory.
3. Run `npm install`.

Now instead of running `npx wordpress-export-to-markdown` you can run `node app`. They both take all the same command line arguments in the same way.

## Contributing

Please read the [contribution guidelines](https://github.com/lonekorean/wordpress-export-to-markdown/blob/master/.github/CONTRIBUTING.md).
