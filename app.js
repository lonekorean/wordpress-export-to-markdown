#!/usr/bin/env node

import chalk from 'chalk';
import * as commander from 'commander';
import path from 'path';
import * as intake from './src/intake.js';
import * as parser from './src/parser.js';
import * as shared from './src/shared.js';
import * as writer from './src/writer.js';

(async () => {
	// configure command line help output
	commander.program
		.name('npx wordpress-export-to-markdown')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.addHelpText('after', '\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown')
		.configureHelp({
			styleOptionTerm: (str) => str.replace(/(<.*>)$/, chalk.gray('$1')),
			styleOptionDescription: (str) => str.replace(/(\(.*\))$/, chalk.gray('$1'))
		});
		
	// gather config options from command line and wizard
	await intake.getConfig();

	// parse data from XML and do Markdown translations
	const posts = await parser.parseFilePromise()

	// write files and download images
	await writer.writeFilesPromise(posts);

	// happy goodbye
	console.log('\nAll done!');
	console.log('Look for your output files in: ' + path.resolve(shared.config.output));
})().catch((ex) => {
	// sad goodbye
	console.log('\nSomething went wrong, execution halted early.');
	console.error(ex);
});
