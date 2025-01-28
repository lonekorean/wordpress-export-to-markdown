import camelcase from 'camelcase';
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
	const commandLineQuestions = questions.all;
	const commandLineAnswers = getCommandLineAnswers(commandLineQuestions);

	let wizardAnswers;
	if (commandLineAnswers.wizard) {
		console.log('\nStarting wizard...');

		// run wizard for remaining config options
		const wizardQuestions = questions.all.filter((question) => !(camelcase(question.name) in commandLineAnswers));
		wizardAnswers = await getWizardAnswers(wizardQuestions, commandLineAnswers);
	} else {
		console.log('\nSkipping wizard...');
	}

	return { ...commandLineAnswers, ...wizardAnswers };
}

function getCommandLineAnswers(questions) {
	// show errors in red
	commander.program.configureOutput({
		outputError: (str, write) => write(chalk.red(str))
	});
	
	questions.forEach((question) => {
		const option = new commander.Option('--' + question.name + ' <' + question.type + '>', question.description);
		option.default(question.default);

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

		if (answers.wizard) {
			// remove this default answer so the wizard will ask about it later
			delete answers[key];
		} else {
			// normalize and validate default answer
			const question = questions.find((question) => camelcase(question.name) === key);
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
		let answerKey = camelcase(question.name);
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
				// create a snapshot config of command line answers and wizard answers so far
				const config = { ...commandLineAnswers, ...answers };

				promptConfig.choices.forEach((choice) => {
					// show example path if this choice is selected
					config[answerKey] = choice.value;
					choice.description = buildSamplePostPath(config);
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

export function buildSamplePostPath(config) {
	const outputDir = path.sep;
	const type = ''
	const date = luxon.DateTime.now().toFormat('yyyy-LL-dd');
	const slug = 'my-post';

	return shared.buildPostPath(outputDir, type, date, slug, config);
}
