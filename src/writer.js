const chalk = require('chalk');
const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const requestPromiseNative = require('request-promise-native');

const shared = require('./shared');

async function writeFilesPromise(posts, config) {
	await writeMarkdownFilesPromise(posts, config);
	await writeImageFilesPromise(posts, config);
}

async function processPayloadsPromise(payloads, loadFunc, config) {
	const promises = payloads.map(payload => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item, config);
				await writeFile(payload.dir, payload.filename, data);
				console.log(chalk.green('[OK]') + ' ' + payload.name);
				resolve();
			} catch (ex) {
				console.error(chalk.red('[FAILED]') + ' ' + payload.name + ' ' + chalk.red('(' + ex.toString() + ')'));
				reject();
			}
		}, payload.delay);
	}));
	
	const results = await Promise.allSettled(promises);
	const failedCount = results.filter(result => result.status === 'rejected').length;
	if (failedCount === 0) {
		console.log('Done, got them all!');
	} else {
		console.log('Done, but with ' + chalk.red(failedCount + ' failed') + '.');
	}
}

async function writeFile(dir, filename, data) {
	await fs.promises.mkdir(dir, { recursive: true });
	await fs.promises.writeFile(path.join(dir, filename), data);
}

async function writeMarkdownFilesPromise(posts, config ) {
	// package up posts into payloads
	const payloads = posts.map((post, index) => ({
		item: post,
		name: post.meta.slug,
		dir:  getPostDir(post, config),
		filename: getPostFilename(post, config),
		delay: index * 25
	}));

	console.log('\nSaving posts...');
	await processPayloadsPromise(payloads, loadMarkdownFilePromise, config);
}

async function loadMarkdownFilePromise(post) {
	let output = '---\n';
	Object.entries(post.frontmatter).forEach(pair => {
		const key = pair[0];
		const value = pair[1].replace(/"/g, '\\"');
		output += key + ': "' + value + '"\n';
	});
	output += '---\n\n' + post.content + '\n';
	return output;
}

async function writeImageFilesPromise(posts, config) {
	// collect image data from all posts into a single flattened array of payloads
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const postDir = getPostDir(post, config);
		return post.meta.imageUrls.map(imageUrl => {
			const filename = shared.getFilenameFromUrl(imageUrl)
			const payload = {
				item: imageUrl,
				name: filename,
				dir: path.join(postDir, 'image'),
				filename,
				delay
			};
			delay += 100;
			return payload;
		});
	});

	console.log('\nSaving images...');
	await processPayloadsPromise(payloads, loadImageFilePromise);
}

async function loadImageFilePromise(imageUrl) {
	let buffer;
	try {
		buffer = await requestPromiseNative.get({
			url: imageUrl,
			encoding: null // preserves binary encoding
		});
	} catch (ex) {
		if (ex.name === 'StatusCodeError') {
			// these errors contain a lot of noise, simplify to just the status code
			ex.message = ex.statusCode;
		}
		throw ex;
	}
	return buffer;
}

function getPostDir(post, config) {
	let dir = config.output;
	let dt = luxon.DateTime.fromISO(post.frontmatter.date);

	if (config.yearmonthfolders) {
		dir = path.join(dir, dt.toFormat('yyyy'), dt.toFormat('LL'));
	} else if (config.yearfolders) {
		dir = path.join(dir, dt.toFormat('yyyy'));
	}

	if (config.postfolders) {
		let folder = post.meta.slug;
		if (config.prefixdate) {
			folder = dt.toFormat('yyyy-LL-dd') + '-' + folder;
		}
		dir = path.join(dir, folder);
	}

	return dir;
}

function getPostFilename(post, config) {
	if (config.postfolders) {
		// the containing folder name will be unique, just use index.md here
		return 'index.md';
	} else {
		let filename = post.meta.slug + '.md';
		if (config.prefixdate) {
			let dt = luxon.DateTime.fromISO(post.frontmatter.date);
			filename = dt.toFormat('yyyy-LL-dd') + '-' + filename;
		}
		return filename;
	}
}

exports.writeFilesPromise = writeFilesPromise;
