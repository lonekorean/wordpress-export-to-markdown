const package = require('./package.json');

const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

(async () => {
	console.log('Starting ' + package.name + ' v' + package.version + '...');
	config = wizard.getConfig();
	let posts = await parser.parseFilePromise(config)
	await writer.writeFilesPromise(posts, config);
})().catch(ex => {
	console.error(ex);
});
