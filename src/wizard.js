import camelcase from 'camelcase';
import chalk from 'chalk';
import * as commander from 'commander';
import * as normalizers from './normalizers.js';
import * as questions from './questions.js';

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

	const commandLineQuestions = questions.all;
	Object.assign(config, getCommandLineAnswers(commandLineQuestions));

	if (config.wizard) {
		console.log('\nStarting wizard...');
		const wizardQuestions = questions.all.filter((question) => question.name !== 'wizard' && !(camelcase(question.name) in config));
		Object.assign(config, await getWizardAnswers(wizardQuestions));
	} else {
		console.log('\nSkipping wizard...');
	}

	return config;
}

function getCommandLineAnswers(questions) {
	questions.forEach((question) => {
		const option = new commander.Option('--' + question.name + ' <' + question.type + '>', question.description);
		option.default(question.default);

		if (question.choices && question.type !== 'boolean') {
			option.choices(question.choices.map((choice) => choice.value));
		} else {
			option.argParser((value) => normalize(value, question.type, (errorMessage) => {
				throw new commander.InvalidArgumentError(errorMessage);
			}));
		}

		commander.program.addOption(option);
	});

	const answers = commander.program.parse().opts();

	for (const [key, value] of Object.entries(answers)) {
		if (key === 'wizard' || commander.program.getOptionValueSource(key) !== 'default') {
			continue;
		}

		if (answers.wizard) {
			delete answers[key];
		} else {
			const option = questions.find((option) => camelcase(option.name) === key);
			answers[key] = normalize(value, option.type, (errorMessage) => {
				commander.program.error(`error: option '--${option.name} <${option.type}>' argument '${value}' is invalid. ${errorMessage}`);
			});
		}
	}

	return answers;
}

export async function getWizardAnswers(questions) {
	const answers = {};
	for (const question of questions) {
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
