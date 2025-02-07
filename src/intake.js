import chalk from 'chalk';
import * as commander from 'commander';
import * as luxon from 'luxon';
import path from 'path';
import * as normalizers from './normalizers.js';
import * as questions from './questions.js';
import * as shared from './shared.js';

// visual formatting for wizard
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
	// check command line for any config options
	const commandLineQuestions = questions.load();
	const commandLineAnswers = getCommandLineAnswers(commandLineQuestions);

	let wizardAnswers;
	if (commandLineAnswers.wizard) {
		console.log('\nStarting wizard...');

		// run wizard for questions with prompts that were not answered via the command line
		const wizardQuestions = questions.load().filter((question) => {
			return question.prompt && !(shared.camelCase(question.name) in commandLineAnswers);
		});
		wizardAnswers = await getWizardAnswers(wizardQuestions, commandLineAnswers);
	} else {
		console.dir('\nSkipping wizard...');
	}

	Object.assign(shared.config, commandLineAnswers, wizardAnswers);
}

function getCommandLineAnswers(questions) {
	// show errors in red
	commander.program.configureOutput({
		outputError: (str, write) => write(chalk.red(str))
	});
	
	questions.forEach((question) => {
		const option = new commander.Option('--' + question.name + ' <' + question.type + '>', question.description);
		option.default(question.default);

		if (!question.description) {
			option.hideHelp();
		}

		if (question.choices && question.type !== 'boolean') {
			// let commander handle non-boolean multiple choice validation
			option.choices(question.choices.map((choice) => choice.value));
		} else {
			option.argParser((value) => normalize(value, question.type, (errorMessage) => {
				throw new commander.InvalidArgumentError(errorMessage);
			}));
		}

		commander.program.addOption(option);
	});

	const answers = commander.program.parse().opts();

	// do some post-processing on the answers
	for (const [key, value] of Object.entries(answers)) {
		// the "wizard" answer and any user-provided (not defaulted) answers are left alone
		if (key === 'wizard' || commander.program.getOptionValueSource(key) !== 'default') {
			continue;
		}

		const question = questions.find((question) => shared.camelCase(question.name) === key);
		if (answers.wizard && question.prompt) {
			// remove this default answer, allowing the wizard to ask about it later
			delete answers[key];
		} else {
			// normalize and validate default answer
			answers[key] = normalize(value, question.type, (errorMessage) => {
				// this is formatted to match how commander displays other errors
				commander.program.error(`error: option '--${question.name} <${question.type}>' argument '${value}' is invalid. ${errorMessage}`);
			});
		}
	}

	return answers;
}

export async function getWizardAnswers(questions, commandLineAnswers) {
	const answers = {};
	for (const question of questions) {
		let answerKey = shared.camelCase(question.name);
		let normalizedAnswer; // holds normalized answer value potentially returned during validation

		const promptConfig = {
			theme: promptTheme,
			message: question.description + '?',
			default: question.default,
		};

		if (question.choices) {
			promptConfig.choices = question.choices;
			promptConfig.loop = false;

			if (question.isPathQuestion) {
				promptConfig.choices.forEach((choice) => {
					// show example path if this choice is selected
					choice.description = buildSamplePostPath({
						...commandLineAnswers,		// with command line answers
						...answers,					// and wizard answers so far
						output: path.sep,			// and a simplified output folder
						[answerKey]: choice.value	// and this choice selected
					});
				});
			}
		} else {
			promptConfig.validate = (value) => {
				let validationErrorMessage;
				normalizedAnswer = normalize(value, question.type, (errorMessage) => {
					validationErrorMessage = errorMessage;
				});
				return validationErrorMessage ?? true;
			}
		}

		const answer = await question.prompt(promptConfig).catch((ex) => {
			// exit gracefully if user hits ctrl + c during wizard
			if (ex instanceof Error && ex.name === 'ExitPromptError') {
				console.log('\nUser quit wizard early.');
				process.exit(0);
			} else {
				throw ex;
			}
		});

		answers[answerKey] = normalizedAnswer ?? answer;
	}

	return answers;
}

function normalize(value, type, onError) {
	const normalizer = normalizers[shared.camelCase(type)];
	if (!normalizer) {
		return value;
	}

	try {
		return normalizer(value);
	} catch (ex) {
		onError(ex.message);
	}
}

export function buildSamplePostPath(overrideConfig) {
	return shared.buildPostPath('', luxon.DateTime.now(), 'my-post', overrideConfig);
}
