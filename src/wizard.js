const camelcase = require('camelcase');
const commander = require('commander');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');

const package = require('../package.json');

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
		aliases: ['yearfolders', 'yearmonthfolders'],
		type: 'boolean',
		description: 'Create year folders',
		default: false
	},
	{
		name: 'month-folders',
		aliases: ['yearmonthfolders'],
		type: 'boolean',
		description: 'Create month folders',
		default: false
	},
	{
		name: 'post-folders',
		aliases: ['postfolders'],
		type: 'boolean',
		description: 'Create a folder for each post',
		default: true
	},
	{
		name: 'prefix-date',
		aliases: ['prefixdate'],
		type: 'boolean',
		description: 'Prefix post folders/files with date',
		default: false
	},
	{
		name: 'save-attached-images',
		aliases: ['saveimages'],
		type: 'boolean',
		description: 'Save images attached to posts',
		default: true
	},
	{
		name: 'save-scraped-images',
		aliases: ['addcontentimages'],
		type: 'boolean',
		description: 'Save images scraped from post body content',
		default: true
	},
	{
		name: 'include-other-types',
		type: 'boolean',
		description: 'Include custom post types and pages',
		default: false
	}
];

async function getConfig(argv) {
	extendOptionsData();
	const unaliasedArgv = replaceAliases(argv);
	const program = parseCommandLine(unaliasedArgv);

	let answers;
	if (program.wizard) {
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

	const config = { ...program.opts(), ...answers };
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

function replaceAliases(argv) {
	let paths = argv.slice(0, 2);
	let replaced = [];
	let unmodified = [];

	argv.slice(2).forEach(arg => {
		let aliasFound = false;

		// this loop does not short circuit because an alias can map to multiple options
		options.forEach(option => {
			const aliases = option.aliases || [];
			aliases.forEach(alias => {
				if (arg.includes('--' + alias)) {
					replaced.push(arg.replace('--' + alias, '--' + option.name));
					aliasFound = true;
				}	
			});
		});

		if (!aliasFound) {
			unmodified.push(arg);
		}
	});

	return [...paths, ...replaced, ...unmodified];
}

function parseCommandLine(argv) {
	// setup for help output
	commander
		.name('node index.js')
		.version('v' + package.version, '-v, --version', 'Display version number')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.on('--help', () => {
			console.log('\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown');
		});

	options.forEach(input => {
		const flag = '--' + input.name + ' <' + input.type + '>';
		const coerce = (value) => {
			// commander only calls coerce when an input is provided on the command line, which
			// makes for an easy way to flag (for later) if it should be excluded from the wizard
			input.isProvided = true;
			return input.coerce(value);
		};
		commander.option(flag, input.description, coerce, input.default);
	});

	return commander.parse(argv);
}

function coerceBoolean(value) {
	return !['false', 'no', '0'].includes(value.toLowerCase());
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

exports.getConfig = getConfig;
