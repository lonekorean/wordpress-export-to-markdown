const camelcase = require('camelcase');
const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');

// expected user inputs are declard here
const inputs = [
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
		description: 'Path to input file',
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

async function getConfig() {
	extendInputsData();
	const program = parseCommandLine(process.argv);

	let questions = inputs.map(input => ({
		when: input.name !== 'wizard' && program.wizard && !input.isProvided,
		name: camelcase(input.name),
		type: input.prompt,
		message: input.description + '?',
		default: input.default,

		// boolean inputs don't use filter or validate, which is fine
		filter: input.coerce,
		validate: input.validate
	}));
	let answers = await inquirer.prompt(questions);

	const config = { ...program.opts(), ...answers };
	return config;
}

function extendInputsData() {
	// based on each input's type, add more data that will be used later
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
			coerce: coercePath,
			validate: validateFolder
		}
	};

	inputs.forEach(input => {
		Object.assign(input, map[input.type]);
	});
}

function parseCommandLine(argv) {
	// setup for help output
	commander
		.name('node index.js')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.on('--help', () => {
			console.log('\nMore documentation at https://github.com/lonekorean/wordpress-export-to-markdown');
		})

	inputs.forEach(input => {
		const flag = '--' + input.name + ' <' + input.type + '>';
		const coerce = (value) => {
			// commander only calls coerce when an input is present on the command line, which
			// provides an easy way to flag (for later) if it should be excluded from the wizard
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
	if (checkFileExists(value)) {
		return true;
	} else {
		return 'Unable to find file: ' + path.resolve(value);
	}
}

function validateFolder(value) {
	// TODO: implement
	return true;
}

function checkFileExists(path) {
	try {
		return fs.existsSync(path);
	} catch (ex) {
		return false;
	}
}

exports.getConfig = getConfig;
