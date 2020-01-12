const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

(async () => {
	let config = await wizard.getConfig();
	let posts = await parser.parseFilePromise(config)
	await writer.writeFilesPromise(posts, config);
	wizard.displayCommand(config);
})().catch(ex => {
	console.error(ex);
});
