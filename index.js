#!/usr/bin/env node

const path = require('path');
const process = require('process');

const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

(async () => {
	// parse any command line arguments and run wizard
	const config = await wizard.getConfig(process.argv);

	// parse data from XML and do Markdown translations
	const posts = await parser.parseFilePromise(config)

	// write files, downloading images as needed
	await writer.writeFilesPromise(posts, config);

	// happy goodbye
	console.log('\nAll done!');
	console.log('Look for your output files in: ' + path.resolve(config.output));
})().catch(ex => {
	// sad goodbye
	console.log('\nSomething went wrong, execution halted early.');
	console.error(ex);
});
