const axios = require('axios');
const chalk = require('chalk');
const fs = require('fs');
const http = require('http');
const https = require('https');
const luxon = require('luxon');
const path = require('path');

const shared = require('./shared');
const settings = require('./settings');

async function writeFilesPromise(posts, config) {
	await writeMarkdownFilesPromise(posts, config);
	await writeImageFilesPromise(posts, config);
}

async function processPayloadsPromise(payloads, loadFunc) {
	const promises = payloads.map(payload => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item);
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

async function writeMarkdownFilesPromise(posts, config) {
	// package up posts into payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const destinationPath = getPostPath(post, config);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			skipCount++;
			return [];
		} else {
			const payload = {
				item: post,
				name: (config.includeOtherTypes ? post.meta.type + ' - ' : '') + post.meta.slug,
				destinationPath,
				delay
			};
			delay += settings.markdown_file_write_delay;
			return [payload];
		}
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo posts to save...');
	} else {
		console.log(`\nSaving ${remainingCount} posts (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadMarkdownFilePromise);
	}
}

async function loadMarkdownFilePromise(post) {
	let output = '---\n';

	Object.entries(post.frontmatter).forEach(([key, value]) => {
		let outputValue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				// array of one or more strings
				outputValue = value.reduce((list, item) => `${list}\n  - "${item}"`, '');
			}
		} else {
			// single string value
			const escapedValue = (value || '').replace(/"/g, '\\"');
			if (escapedValue.length > 0) {
				outputValue = `"${escapedValue}"`;
			}
		}

		if (outputValue !== undefined) {
			output += `${key}: ${outputValue}\n`;
		}
	});

	output += `---\n\n${post.content}\n`;
	return output;
}

async function writeImageFilesPromise(posts, config) {
	// collect image data from all posts into a single flattened array of payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const postPath = getPostPath(post, config);
		const imagesDir = path.join(path.dirname(postPath), 'images');
		return post.meta.imageUrls.flatMap(imageUrl => {
			const filename = shared.getFilenameFromUrl(imageUrl);
			const destinationPath = path.join(imagesDir, filename);
			if (checkFile(destinationPath)) {
				// already exists, don't need to save again
				skipCount++;
				return [];
			} else {
				const payload = {
					item: imageUrl,
					name: filename,
					destinationPath,
					delay
				};
				delay += settings.image_file_request_delay;
				return [payload];
			}
		});
	});

	const remainingCount = payloads.length;
	if (remainingCount + skipCount === 0) {
		console.log('\nNo images to download and save...');
	} else {
		console.log(`\nDownloading and saving ${remainingCount} images (${skipCount} already exist)...`);
		await processPayloadsPromise(payloads, loadImageFilePromise);
	}
}

async function loadImageFilePromise(imageUrl) {
	// only encode the URL if it doesn't already have encoded characters
	const url = (/%[\da-f]{2}/i).test(imageUrl) ? imageUrl : encodeURI(imageUrl);

	const config = {
		method: 'get',
		url,
		headers: {
			'User-Agent': 'wordpress-export-to-markdown'
		},
		responseType: 'arraybuffer'
	};

	if (!settings.strict_ssl) {
		// custom agents to disable SSL errors (adding both http and https, just in case)
		config.httpAgent = new http.Agent({ rejectUnauthorized: false });
		config.httpsAgent = new https.Agent({ rejectUnauthorized: false });
	}

	let buffer;
	try {
		const response = await axios(config);
		buffer = Buffer.from(response.data, 'binary');
	} catch (ex) {
		if (ex.response) {
			// request was made, but server responded with an error status code
			throw 'StatusCodeError: ' + ex.response.status;
		} else {
			// something else went wrong, rethrow
			throw ex;
		}
	}
	return buffer;
}

function getPostPath(post, config) {
	let dt;
	if (settings.custom_date_formatting) {
		dt = luxon.DateTime.fromFormat(post.frontmatter.date, settings.custom_date_formatting);
	} else {
		dt = luxon.DateTime.fromISO(post.frontmatter.date);
	}

	// start with base output dir
	const pathSegments = [config.output];

	// create segment for post type if we're dealing with more than just "post"
	if (config.includeOtherTypes) {
		pathSegments.push(post.meta.type);
	}

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

function checkFile(path) {
	return fs.existsSync(path);
}

exports.writeFilesPromise = writeFilesPromise;
