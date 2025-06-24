import * as inquirer from '@inquirer/prompts';

export function load() {
	// questions with a description are displayed in command line help
	// questions with a prompt are included in the wizard (if not set on the command line)
	return [
		{
			name: 'input',
			type: 'file-path',
			description: 'Path to WordPress export file',
			default: 'export.xml',
			prompt: inquirer.input
		},
		{
			name: 'post-folders',
			type: 'boolean',
			description: 'Put each post into its own folder',
			default: true,
			choices: [
				{
					name: 'Yes',
					value: true
				},
				{
					name: 'No',
					value: false
				}
			],
			isPathQuestion: true,
			prompt: inquirer.select
		},
		{
			name: 'prefix-date',
			type: 'boolean',
			description: 'Add date prefix to posts',
			default: false,
			choices: [
				{
					name: 'Yes',
					value: true
				},
				{
					name: 'No',
					value: false
				}
			],
			isPathQuestion: true,
			prompt: inquirer.select
		},
		{
			name: 'date-folders',
			type: 'choice',
			description: 'Organize posts into date folders',
			default: 'none',
			choices: [
				{
					name: 'Year folders',
					value: 'year'
				},
				{
					name: 'Year and month folders',
					value: 'year-month'
				},
				{
					name: 'No',
					value: 'none'
				}
			],
			isPathQuestion: true,
			prompt: inquirer.select
		},
		{
			name: 'save-images',
			type: 'choice',
			description: 'Save images',
			default: 'all',
			choices: [
				{
					name: 'Images attached to posts',
					value: 'attached'
				},
				{
					name: 'Images scraped from post body content',
					value: 'scraped'
				},
				{
					name: 'All Images',
					value: 'all'
				},
				{
					name: 'No',
					value: 'none'
				}
			],
			prompt: inquirer.select
		},
		{
			name: 'wizard',
			type: 'boolean',
			description: 'Use wizard',
			default: true
		},
		{
			name: 'output',
			type: 'folder-path',
			description: 'Path to output folder',
			default: 'output'
		},
		{
			name: 'frontmatter-fields',
			type: 'list',
			description: 'Frontmatter fields',
			default: 'title,date,categories,tags,coverImage,draft'
		},
		{
			name: 'frontmatter-meta',
			type: 'list',
			description: 'Meta fields to add to frontmatter',
			// e.g. 'rank_math_seo_score,rank_math_contentai_score'
			default: []
		},
		{
			name: 'append-meta',
			type: 'list',
			description: 'Meta fields to apend to the content as MDC components',
			default: []
		},
    {
      name: 'strip-shortcodes',
      type: 'boolean',
      description: 'Strip shortcodes from content',
      default: false
    },
    {
      name: 'polylang',
      type: 'boolean',
      description: 'Process Polylang translation sets',
      default: false
    },
    {
      name: 'polylang-default-language',
      type: 'string',
      description: 'Polylang translation set to process',
      default: 'en'
    },
		{
			name: 'post-types',
			type: 'list',
			description: 'Post types to convert (empty for all)',
			default: []
		},
		{
			name: 'exclude-post-types',
			type: 'list',
			description: 'Post types to convert (empty for all)',
			default: []
		},
    {
      name: 'include-categories',
      type: 'list',
      description: 'Only export posts in these category slugs (domain="category")',
      // e.g. 'news,resources,updates'
      default: [],
    },
    {
      name: 'exclude-categories',
      type: 'list',
      description: 'Exclude posts in these categories',
      default: [],
    },
		{
			name: 'request-delay',
			type: 'integer',
			description: 'Delay between image file requests',
			default: 500
		},
		{
			name: 'write-delay',
			type: 'integer',
			description: 'Delay between writing markdown files',
			default: 25
		},
		{
			name: 'timezone',
			type: 'string',
			description: 'Timezone to apply to date',
			default: 'utc'
		},
		{
			name: 'include-time',
			type: 'boolean',
			description: 'Include time with frontmatter date',
			default: false
		},
		{
			name: 'date-format',
			type: 'string',
			description: 'Frontmatter date format string',
			default: ''
		},
		{
			name: 'quote-date',
			type: 'boolean',
			description: 'Wrap frontmatter date in quotes',
			default: false
		},
		{
			name: 'strict-ssl',
			type: 'boolean',
			description: 'Use strict SSL',
			default: true
		}
	];
}
