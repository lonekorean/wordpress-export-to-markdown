import * as inquirer from '@inquirer/prompts';

// questions with a description are displayed in command line help
// questions with a prompt are included in the wizard (if not set on the command line)
export const all = [
	{
		name: 'wizard',
		type: 'boolean',
		description: 'Use wizard',
		default: true
	},
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
		description: 'Prefix with date',
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
		description: 'Organize into folders based on date',
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
				name: 'Both',
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
		name: 'output',
		type: 'folder-path',
		description: 'Path to output folder',
		default: 'output'
	},
	{
		name: 'frontmatter-fields',
		type: 'list',
		default: ['title', 'date', 'categories', 'tags', 'coverImage']
	},
	{
		name: 'image-file-request-delay',
		type: 'integer',
		default: 500
	},
	{
		name: 'markdown-file-write-delay',
		type: 'integer',
		default: 25
	},
	{
		name: 'include-time-with-date',
		type: 'boolean',
		default: false
	},
	{
		name: 'filter-categories',
		type: 'list',
		default: ['uncategorized']
	},
	{
		name: 'strict-ssl',
		type: 'boolean',
		default: true
	}
];
