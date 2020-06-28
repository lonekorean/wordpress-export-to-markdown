const chalk = require('chalk');
const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const requestPromiseNative = require('request-promise-native');

const shared = require('./shared');
const settings = require('./settings');

async function writeFilesPromise(posts, config) {
	await writeMarkdownFilesPromise(posts, config);
	await writeImageFilesPromise(posts, config);
}

async function processPayloadsPromise(payloads, loadFunc, config) {
	const promises = payloads.map(payload => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item, config);
				await writeFile(payload.destinationPath, data);
				console.log(chalk.green('[OK]') + ' ' + payload.name);
				resolve();
			} catch (ex) {
				console.log(chalk.red('[FAILED]') + ' ' + payload.name + ' ' + chalk.red('(' + ex.toString() + ')'));
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

async function writeFile(destinationPath, data) {
	await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
	await fs.promises.writeFile(destinationPath, data);
}

async function writeMarkdownFilesPromise(posts, config ) {
	// package up posts into payloads
	const payloads = posts.map((post, index) => ({
		item: post,
		name: post.meta.slug,
		destinationPath: getPostPath(post, config),
		delay: index * settings.markdown_file_write_delay
	}));

	console.log('\nSaving posts...');
	await processPayloadsPromise(payloads, loadMarkdownFilePromise, config);
}

async function loadMarkdownFilePromise(post) {
	let output = '---\n';
	Object.entries(post.frontmatter).forEach(pair => {
		const key = pair[0];
		const value = Array.isArray(pair[1])
			? (pair[1].length === 0 ? "" : "\n  - \"" + pair[1].join("\"\n  - \"") + "\"")
			: '"' + (pair[1] || '').replace(/"/g, '\\"') +'"';
		output += key + ': ' + value + '\n';
	});
	output += '---\n\n' + post.content + '\n';
	return output;
}

async function writeImageFilesPromise(posts, config) {
	// collect image data from all posts into a single flattened array of payloads
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const postPath = getPostPath(post, config);
		const imagesDir = path.join(path.dirname(postPath), 'images');
		return post.meta.imageUrls.map(imageUrl => {
			const filename = shared.getFilenameFromUrl(imageUrl);
			const payload = {
				item: imageUrl,
				name: filename,
				destinationPath: path.join(imagesDir, filename),
				delay
			};
			delay += settings.image_file_request_delay;
			return payload;
		});
	});

	if (payloads.length > 0) {
		console.log('\nDownloading and saving images...');
		await processPayloadsPromise(payloads, loadImageFilePromise);
	} else {
		console.log('\nNo images to download and save...');
	}
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

function getPostPath(post, config) {
	const dt = luxon.DateTime.fromISO(post.frontmatter.date);

	// start with base output dir
	const pathSegments = [config.output];

	if (config.yearFolders) {
		pathSegments.push(dt.toFormat('yyyy'));
	}

	if (config.monthFolders) {
		pathSegments.push(dt.toFormat('LL'));
	}

	// create slug fragment, possibly date prefixed
	let slugFragment = post.meta.slug;
	if (config.prefixDate) {
		slugFragment = dt.toFormat('yyyy-LL-dd') + '-' + slugFragment;
	}

	// use slug fragment as folder or filename as specified
	if (config.postFolders) {
		pathSegments.push(slugFragment, 'index.md');
	} else {
		pathSegments.push(slugFragment + '.md');
	}

	return path.join(...pathSegments);
}

exports.writeFilesPromise = writeFilesPromise;
