# How to Contribute

Contributions are welcome! Thank you!

## General Guidelines

Some quick notes when making a pull request.

- Match the style and formatting of the code you are editing.
- Each pull request should be focused on a single thing (a single bug fix, a single feature, etc.). This makes reviewing easier and minimizes merge conflicts.
- Include a description of the problem being solved and what your code does. Steps to reproduce the problem or example input/output are very helpful.

## Adding Options

Keeping the wizard as short as possible is a priority. Pull requests that add options to the wizard will probably not be accepted. Instead, you can add an advanced setting to [settings.js](https://github.com/lonekorean/wordpress-export-to-markdown/blob/master/src/settings.js).

## Adding Frontmatter Fields

Similarly, default frontmatter output is limited to just a few widely used fields to avoid bloat. However, you may add new optional frontmatter fields.

To do so, follow the instructions in [/src/frontmatter/example.js](https://github.com/lonekorean/wordpress-export-to-markdown/blob/master/src/frontmatter/example.js).

Users will be able to include your new frontmatter field by editing `frontmatter_fields` in [settings.js](https://github.com/lonekorean/wordpress-export-to-markdown/blob/master/src/settings.js).
