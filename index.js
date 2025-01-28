#!/usr/bin/env node

import * as commander from 'commander';
import path from 'path';
import * as parser from './src/parser.js';
import * as settings from './src/settings.js';
import * as intake from './src/intake.js';
import * as writer from './src/writer.js';

(async () => {
	// configure command line help output
	commander.program
		.name('node index.js')
		.helpOption('-h, --help', 'See the thing you\'re looking at right now')
		.addHelpText('after', '\nMore documentation is at https://github.com/lonekorean/wordpress-export-to-markdown')
		
	// gather config options from command line and wizard
	const config = await intake.getConfig();

	// parse data from XML and do Markdown translations
	const posts = await parser.parseFilePromise(config)

	// write files and download images
	await writer.writeFilesPromise(posts, config);

	// happy goodbye
	console.log('\nAll done!');
	console.log('Look for your output files in: ' + path.resolve(settings.output_directory));
})().catch((ex) => {
	// sad goodbye
	console.log('\nSomething went wrong, execution halted early.');
	console.error(ex);
});
