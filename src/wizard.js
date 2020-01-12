const camelcase = require('camelcase');
const chalk = require('chalk');
const commander = require('commander');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');

// all user options for command line and wizard are declard here
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
	extendOptionsData();
	const program = parseCommandLine(process.argv);

	let answers;
	if (program.wizard) {
		console.log('\nStarting wizard...');
		let questions = options.map(option => ({
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

function parseCommandLine(argv) {
	// setup for help output
	commander
		.name('node index.js')
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

function displayCommand(config) {
	let command = 'node index.js --wizard=false';
	options.forEach(option => {
		if (option.name !== 'wizard') {
			let configKey = camelcase(option.name);
			let configValue = config[configKey];
			if (configValue !== option.default) {
				command += ' --' + option.name + '=' + configValue;
			}
		}
	});
	console.log('\nTo skip the wizard and rerun with the same options, run this:\n' + command);
}

exports.getConfig = getConfig;
exports.displayCommand = displayCommand;
