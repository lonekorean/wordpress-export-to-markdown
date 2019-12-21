const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

(async () => {
	config = wizard.getConfig();
	let posts = await parser.parseFilePromise(config)
	await writer.writeFilesPromise(posts, config);
})().catch(ex => {
	console.error(ex);
});
