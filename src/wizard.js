import * as inquirer from '@inquirer/prompts';
import camelcase from 'camelcase';
import chalk from 'chalk';
import * as commander from 'commander';
import fs from 'fs';
import path from 'path';

// all user options for command line and wizard are declared here
const options = [
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
				value: true,
				description: '/my-post/index.md'
			},
			{
				name: 'No',
				value: false,
				description: '/my-post.md'
			}
		],
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
				value: true,
				description: ''
			},
			{
				name: 'No',
				value: false,
				description: ''
			}
		],
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
				value: 'year',
				description: ''
			},
			{
				name: 'Year and month folders',
				value: 'year-month',
				description: ''
			},
			{
				name: 'No',
				value: 'none',
				description: ''
			}
		],
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
	}
];

const validators = {
	'boolean': (value) => {
		if (typeof value === 'boolean') {
			return value;
		} else if (value === 'true') {
			return true;
		} else if (value === 'false') {
			return false;
		}

		throw 'Must be true or false.';
	},
	'file-path': (value) => {
		const unwrapped = value.replace(/"(.*?)"/, '$1');
		const absolute = path.resolve(unwrapped);

		let fileExists;
		try {
			fileExists = fs.existsSync(absolute) && fs.statSync(absolute).isFile();
		} catch (ex) {
			fileExists = false;
		}

		if (fileExists) {
			return absolute;
		} else {
			throw 'File not found at ' + absolute + '.';
		}
	}
};

export async function getConfig(argv) {
	const opts = parseCommandLine(argv);

	const answers = {};
	if (opts.wizard) {
		console.log('\nStarting wizard...');
		const questions = options.filter(option => (option.name !== 'wizard' && !option.isProvided));
		for (const question of questions) {
			let answer = await question.prompt({
				message: question.description + '?',
				choices: question.choices,
				loop: false,
				default: question.default,
				validate: question.validate, // not all questions have this, which is fine

				theme: {
					prefix: {
						idle: chalk.cyan('\n?'),
						done: chalk.green('✓')
					},
					style: {
						description: (text) => chalk.gray('example: ' + text)
					}
				}
			}).catch((ex) => {
				if (ex instanceof Error && ex.name === 'ExitPromptError') {
					console.log('\nUser quit wizard early.');
					process.exit(0);
				} else {
					throw ex;
				}
			});

			if (question.normalize) {
				answer = question.normalize(answer);
			}

			answers[camelcase(question.name)] = answer;
		}
	} else {
		console.log('\nSkipping wizard...');
	}

	const config = { ...opts, ...answers };
	return config;
}

function parseCommandLine() {
	commander.program
		.name('node index.js')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.addHelpText('after', '\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown')
		.configureOutput({
			outputError: (str, write) => write(chalk.red(str))
		});


	options.forEach(input => {
		const flag = '--' + input.name + ' <' + input.type + '>';
		const option = new commander.Option(flag, input.description);
		option.default(input.default);

		if (input.choices && input.type !== 'boolean') {
			option.choices(input.choices.map((choice) => choice.value));
		} else {
			option.argParser((value) => {
				const validator = validators[input.type];
				if (!validator) {
					return value;
				}

				try {
					return validator(value);
				} catch (ex) {
					commander.program.error(`error: option '${flag}' argument '${value}' is invalid. ${ex.toString()}`);
				}
			});
		}

		commander.program.addOption(option);
	});

	commander.program.parse();

	options.forEach((option) => {
		const opt = camelcase(option.name);
		option.isProvided = commander.program.getOptionValueSource(opt) === 'cli';
	});

	return commander.program.opts();
}
