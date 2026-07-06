# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Run the tool locally**: `node app` or `node app.js`
- **Install dependencies**: `npm install`
- **Test with specific options**: `node app --wizard=false --input=export.xml`

There are no build, lint, or test commands defined in this project. It's a pure Node.js CLI tool without a test suite.

## Architecture Overview

This is a Node.js CLI tool that converts WordPress export XML files into Markdown files. The architecture follows a simple pipeline pattern:

### Entry Point
- `app.js`: CLI entry point that orchestrates the workflow using commander.js for argument parsing

### Core Pipeline (app.js:23-29)
1. **Intake** (`src/intake.js`): Collects configuration via CLI arguments and/or interactive wizard
2. **Parse** (`src/parser.js`): Parses WordPress XML export and extracts post data
3. **Write** (`src/writer.js`): Writes Markdown files and downloads images

### Key Modules

**`src/intake.js`**: Configuration gathering
- Parses CLI arguments via commander.js
- Runs interactive wizard via @inquirer/prompts for unset options
- Validates/normalizes input via `src/normalizers.js`
- Config stored in `src/shared.js` `config` object

**`src/parser.js`**: XML parsing and data extraction
- Uses `src/data.js` wrapper around xml2js for XML traversal
- Extracts posts, pages, custom post types (excludes: attachment, revision, nav_menu_item, etc.)
- Collects both "attached" images (WordPress media attachments) and "scraped" images (from `<img>` tags)
- Builds post objects with metadata, content, image URLs, and comments

**`src/translator.js`**: HTML to Markdown conversion
- Uses turndown library with GFM plugin
- Custom rules for preserving embedded content (tweets, codepens, iframes, figures)
- Handles WordPress-specific formatting (more tag, code blocks with language)

**`src/writer.js`**: File output
- Writes Markdown files with YAML frontmatter
- Downloads images via axios with configurable delays
- Supports resuming (skips existing files)
- Appends comments to Markdown if `saveComments` is enabled

**`src/shared.js`**: Common utilities
- Global `config` object (populated by intake)
- Path building logic for post folders/files
- `buildPostPath()` implements folder structure rules (post-folders, date-folders, prefix-date)

**`src/frontmatter.js`**: Frontmatter field getters
- Each exported function takes a post object and returns the field value
- Supported fields: title, date, categories, tags, coverImage, draft, excerpt, id, slug, author, type

**`src/questions.js`**: Question definitions for CLI and wizard
- Defines all configuration options with types, defaults, and validation

**`src/normalizers.js`**: Input validation/normalization
- Type-specific validators: boolean, filePath, folderPath, integer, list, choice

**`src/data.js`**: XML data wrapper
- Wraps xml2js output with convenient traversal methods
- Methods: `child()`, `children()`, `childValue()`, `optionalChild()`, etc.
- Tracks expression paths for helpful error messages

### Configuration Options (Key)
- `input`: Path to WordPress export XML
- `output`: Output folder path (default: "output")
- `postFolders`: Each post in its own folder with index.md (vs flat files)
- `prefixDate`: Prepend date to post filenames
- `dateFolders`: Organize into year/year-month folders
- `saveImages`: "attached" | "scraped" | "all" | "none"
- `saveComments`: Export comments to Markdown (default: false)
- `frontmatterFields`: Comma-separated list of fields to include
- `wizard`: Enable/disable interactive wizard

### Dependencies
- `commander`: CLI argument parsing
- `@inquirer/prompts`: Interactive wizard prompts
- `xml2js`: WordPress XML parsing
- `turndown` + `@guyplusplus/turndown-plugin-gfm`: HTML to Markdown
- `axios`: Image downloading
- `luxon`: Date/time handling
- `chalk`: Terminal colors

## Code Style Guidelines

- ES modules (`"type": "module"` in package.json)
- Node.js >= 20.5.0 required
- Tabs for indentation
- No semicolons
- Single quotes for strings
- Match existing code style when editing
