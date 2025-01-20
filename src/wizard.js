import camelcase from 'camelcase';
import * as commander from 'commander';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

// all user options for command line and wizard are declared here
const options = [
	// wizard must always be first
	{
		name: 'wizard',
		type: 'boolean',
		description: 'Use wizard',
		default: true
	},
	{
		name: 'input',
		type: 'file',
		description: 'Path to WordPress export file',
		default: 'export.xml'
	},
	{
		name: 'output',
		type: 'folder',
		description: 'Path to output folder',
		default: 'output'
	},
	{
		name: 'year-folders',
		type: 'boolean',
		description: 'Create year folders',
		default: false
	},
	{
		name: 'month-folders',
		type: 'boolean',
		description: 'Create month folders',
		default: false
	},
	{
		name: 'post-folders',
		type: 'boolean',
		description: 'Create a folder for each post',
		default: true
	},
	{
		name: 'prefix-date',
		type: 'boolean',
		description: 'Prefix post folders/files with date',
		default: false
	},
	{
		name: 'save-attached-images',
		type: 'boolean',
		description: 'Save images attached to posts',
		default: true
	},
	{
		name: 'save-scraped-images',
		type: 'boolean',
		description: 'Save images scraped from post body content',
		default: true
	}
];

export async function getConfig(argv) {
	extendOptionsData();
	const opts = parseCommandLine(argv);

	let answers;
	if (opts.wizard) {
		console.log('\nStarting wizard...');
		const questions = options.map(option => ({
			when: option.name !== 'wizard' && !option.isProvided,
			name: camelcase(option.name),
			type: option.prompt,
			message: option.description + '?',
			default: option.default,
	
			// these are not used for all option types and that's fine
			filter: option.coerce,
			validate: option.validate
		}));
		answers = await inquirer.prompt(questions);
	} else {
		console.log('\nSkipping wizard...');
		answers = {};
	}

	const config = { ...opts, ...answers };
	return config;
}

function extendOptionsData() {
	// add more data to each option based on its type
	const map = {
		boolean: {
			prompt: 'confirm',
			coerce: coerceBoolean,
		},
		file: {
			prompt: 'input',
			coerce: coercePath,
			validate: validateFile
		},
		folder: {
			prompt: 'input',
			coerce: coercePath
		}
	};

	options.forEach(option => {
		Object.assign(option, map[option.type]);
	});
}

function parseCommandLine(argv) {
	// setup for help output
	commander.program
		.name('node index.js')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.addHelpText('after', '\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown');

	options.forEach(input => {
		const flag = '--' + input.name + ' <' + input.type + '>';
		const coerce = (value) => {
			// commander only calls coerce when an input is provided on the command line, which
			// makes for an easy way to flag (for later) if it should be excluded from the wizard
			input.isProvided = true;
			return input.coerce(value);
		};
		commander.program.option(flag, input.description, coerce, input.default);
	});

	commander.program.parse(argv);
	return commander.program.opts();
}

function coerceBoolean(value) {
	return !['false', 'no', '0'].includes(value.toString().toLowerCase());
}

function coercePath(value) {
	return path.normalize(value);
}

function validateFile(value) {
	let isValid;
	try {
		isValid = fs.existsSync(value) && fs.statSync(value).isFile();
	} catch (ex) {
		isValid = false;
	}

	return isValid ? true : 'Unable to find file: ' + path.resolve(value);
}
