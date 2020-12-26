// time in ms to wait between requesting image files
// increase this if you see timeouts or server errors
exports.image_file_request_delay = 500;

// time in ms to wait between saving Markdown files
// increase this if your file system becomes overloaded
exports.markdown_file_write_delay = 25;

// enable this to include time with post dates
// for example, "2020-12-25" would become "2020-12-25T11:20:35.000Z"
exports.include_time_with_date = false;

// override post date formatting with a custom formatting string (for example: 'yyyy LLL dd')
// tokens are documented here: https://moment.github.io/luxon/docs/manual/formatting.html#table-of-tokens
// if set, this takes precedence over include_time_with_date
exports.custom_date_formatting = '';

// categories to be excluded from post frontmatter
// this does not filter out posts themselves, just the categories listed in their frontmatter
exports.filter_categories = ['uncategorized'];
