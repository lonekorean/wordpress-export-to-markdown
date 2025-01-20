// Which fields to include in frontmatter. Look in /src/frontmatter.js to see available fields.
// Order is preserved. If a field has an empty value, it will not be included. You can rename a
// field by providing an alias after a ':'. For example, 'date:created' will include 'date' in
// frontmatter, but renamed to 'created'.
export const frontmatter_fields = [
	'title',
	'date',
	'categories',
	'tags',
	'coverImage'
];

// Time in ms to wait between requesting image files. Increase this if you see timeouts or
// server errors.
export const image_file_request_delay = 500;

// Time in ms to wait between saving Markdown files. Increase this if your file system becomes
// overloaded.
export const markdown_file_write_delay = 25;

// Enable this to include time with post dates. For example, "2020-12-25" would become
// "2020-12-25T11:20:35.000Z".
export const include_time_with_date = false;

// Override post date formatting with a custom formatting string (for example: 'yyyy LLL dd').
// Tokens are documented here: https://moment.github.io/luxon/#/parsing?id=table-of-tokens. If
// set, this takes precedence over include_time_with_date.
export const custom_date_formatting = '';

// Specify the timezone used for post dates. See available zone values and examples here:
// https://moment.github.io/luxon/#/zones?id=specifying-a-zone.
export const custom_date_timezone = 'utc';

// Categories to be excluded from post frontmatter. This does not filter out posts themselves,
// just the categories listed in their frontmatter.
export const filter_categories = ['uncategorized'];

// Strict SSL is enabled as the safe default when downloading images, but will not work with
// self-signed servers. You can disable it if you're getting a "self-signed certificate" error.
export const strict_ssl = true;
