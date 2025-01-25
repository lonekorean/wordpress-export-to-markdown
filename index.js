#!/usr/bin/env node

import path from 'path';
import * as parser from './src/parser.js';
import * as settings from './src/settings.js';
import * as wizard from './src/wizard.js';
import * as writer from './src/writer.js';

(async () => {
	// parse any command line arguments and run wizard
	const config = await wizard.getConfig();

	// parse data from XML and do Markdown translations
	const posts = await parser.parseFilePromise(config)

	// write files, downloading images as needed
	await writer.writeFilesPromise(posts, config);

	// happy goodbye
	console.log('\nAll done!');
	console.log('Look for your output files in: ' + path.resolve(settings.output_directory));
})().catch((ex) => {
	// sad goodbye
	console.log('\nSomething went wrong, execution halted early.');
	console.error(ex);
});
