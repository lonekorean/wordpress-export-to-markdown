import camelcase from 'camelcase';
import chalk from 'chalk';
import * as commander from 'commander';
import * as normalizers from './normalizers.js';
import * as options from './options.js';

const promptTheme = {
	prefix: {
		idle: chalk.gray('\n?'),
		done: chalk.green('✓')
	},
	style: {
		description: (text) => chalk.gray('example: ' + text)
	}
};

export async function getConfig() {
	const config = {};

	const commandLineOptions = options.all;
	Object.assign(config, getCommandLineAnswers(commandLineOptions));
	console.log(1, config);

	if (config.wizard) {
		console.log('\nStarting wizard...');
		const wizardOptions = options.all.filter((option) => option.name !== 'wizard' && !(camelcase(option.name) in config));
		Object.assign(config, await getWizardAnswers(wizardOptions));
	} else {
		console.log('\nSkipping wizard...');
	}

	console.log(2, config);
	return config;
}

function getCommandLineAnswers(options) {
	commander.program
		.name('node index.js')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.addHelpText('after', '\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown')
		.configureOutput({
			outputError: (str, write) => write(chalk.red(str))
		});


	options.forEach((input) => {
		const option = new commander.Option('--' + input.name + ' <' + input.type + '>', input.description);
		option.default(input.default);

		if (input.choices && input.type !== 'boolean') {
			option.choices(input.choices.map((choice) => choice.value));
		} else {
			option.argParser((value) => normalize(value, input.type, (errorMessage) => {
				throw new commander.InvalidArgumentError(errorMessage);
			}));
		}

		commander.program.addOption(option);
	});

	const opts = commander.program.parse().opts();

	for (const [key, value] of Object.entries(opts)) {
		console.log(key, value);
		if (key === 'wizard' || commander.program.getOptionValueSource(key) !== 'default') {
			continue;
		}

		if (opts.wizard) {
			delete opts[key];
		} else {
			const option = options.find((option) => camelcase(option.name) === key);
			opts[key] = normalize(value, option.type, (errorMessage) => {
				commander.program.error(`error: option '--${option.name} <${option.type}>' argument '${value}' is invalid. ${errorMessage}`);
			});
		}
	}

	return opts;
}

export async function getWizardAnswers(options) {
	const answers = {};
	for (const question of options) {
		let normalizedAnswer = undefined;

		const promptConfig = {
			theme: promptTheme,
			message: question.description + '?',
			default: question.default,
		};

		if (question.choices) {
			promptConfig.choices = question.choices;
			promptConfig.loop = false;
		} else {
			promptConfig.validate = (value) => {
				let validationResult;
				normalizedAnswer = normalize(value, question.type, (errorMessage) => {
					validationResult = errorMessage;
				});
				return validationResult ?? true;
			}
		}

		let answer = await question.prompt(promptConfig).catch((ex) => {
			if (ex instanceof Error && ex.name === 'ExitPromptError') {
				console.log('\nUser quit wizard early.');
				process.exit(0);
			} else {
				throw ex;
			}
		});

		answers[camelcase(question.name)] = normalizedAnswer ?? answer;
	}

	return answers;
}

function normalize(value, type, onError) {
	const normalizer = normalizers[camelcase(type)];
	if (!normalizer) {
		return value;
	}

	try {
		return normalizer(value);
	} catch (ex) {
		onError(ex.message);
	}
}
