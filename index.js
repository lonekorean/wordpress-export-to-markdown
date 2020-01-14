const path = require('path');

const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

(async () => {
	// parse any command line arguments and run wizard
	let config = await wizard.getConfig();

	// parse data from XML and do Markdown translations
	let posts = await parser.parseFilePromise(config)

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
