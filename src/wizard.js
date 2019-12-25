const fs = require('fs');
const minimist = require('minimist');

function getConfig() {
	let args = process.argv.slice(2);
	let config = minimist(args, {
		string: [
			'input',
			'output'
		],
		boolean: [
			'yearmonthfolders',
			'yearfolders',
			'postfolders',
			'prefixdate',
			'saveattachedimages',
			'savescrapedimages'
		],
		default: {
			input: 'export.xml',
			output: 'output',
			yearmonthfolders: false,
			yearfolders: false,
			postfolders: true,
			prefixdate: false,
			saveattachedimages: true,
			savescrapedimages: true
		}
	});

	// TODO: when wizard is implemented user will be asked to repeat input instead of bombing
	if (!checkFileExists(config.input)) {
		throw new Error('Input file does not exist.');
	}
	
	delete config._;
	return config;	
}

function checkFileExists(path) {
	try {
		return fs.existsSync(path);
	} catch (ex) {
		return false;
	}
}

exports.getConfig = getConfig;
