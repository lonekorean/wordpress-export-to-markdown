const wizard = require('./src/wizard');
const parser = require('./src/parser');
const writer = require('./src/writer');

async function init() {
	try {
		config = wizard.getConfig();
		let posts = await parser.parseFilePromise(config)
		writer.writeFiles(posts, config);
	} catch (ex) {
		// appease the UnhandledPromiseRejectionWarning
		console.error(ex);
	}
}

init();
