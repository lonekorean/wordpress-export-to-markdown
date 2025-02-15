import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import http from 'http';
import https from 'https';
import * as luxon from 'luxon';
import path from 'path';
import * as shared from './shared.js';

export async function writeFilesPromise(posts) {
	await writeMarkdownFilesPromise(posts);
	await writeImageFilesPromise(posts);
}

async function processPayloadsPromise(payloads, loadFunc) {
	const promises = payloads.map(payload => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item);
				await writeFile(payload.destinationPath, data);
				logPayloadResult(payload);
				resolve();
			} catch (ex) {
				logPayloadResult(payload, ex.message);
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

async function writeMarkdownFilesPromise(posts) {
	// package up posts into payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const destinationPath = shared.buildPostPath(post);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			skipCount++;
			return [];
		} else {
			const payload = {
				item: post,
				type: post.type,
				name: shared.getSlugWithFallback(post),
				destinationPath,
				delay
			};
			delay += shared.config.markdownFileWriteDelay;
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
		} else if (Number.isInteger(value)) {
			// output unquoted
			outputValue = value.toString();
		} else if (value instanceof luxon.DateTime) {
			if (shared.config.customDateFormatting) {
				outputValue = value.toFormat(shared.config.customDateFormatting);
			} else {
				outputValue = shared.config.includeTimeWithDate ? value.toISO() : value.toISODate();
			}

			if (shared.config.quoteDate) {
				outputValue = `"${outputValue}"`;
			}
		} else if (typeof value === 'boolean') {
			// output unquoted
			outputValue = value.toString();
		} else {
			// single string value
			const escapedValue = (value ?? '').replace(/"/g, '\\"');
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

async function writeImageFilesPromise(posts) {
	// collect image data from all posts into a single flattened array of payloads
	let skipCount = 0;
	let delay = 0;
	const payloads = posts.flatMap(post => {
		const postPath = shared.buildPostPath(post);
		const imagesDir = path.join(path.dirname(postPath), 'images');
		return post.imageUrls.flatMap(imageUrl => {
			const filename = shared.getFilenameFromUrl(imageUrl);
			const destinationPath = path.join(imagesDir, filename);
			if (checkFile(destinationPath)) {
				// already exists, don't need to save again
				skipCount++;
				return [];
			} else {
				const payload = {
					item: imageUrl,
					type: 'image',
					name: filename,
					destinationPath,
					delay
				};
				delay += shared.config.imageFileRequestDelay;
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

	const requestConfig = {
		method: 'get',
		url,
		headers: {
			'User-Agent': 'wordpress-export-to-markdown'
		},
		responseType: 'arraybuffer'
	};

	if (!shared.config.strictSsl) {
		// custom agents to disable SSL errors (adding both http and https, just in case)
		requestConfig.httpAgent = new http.Agent({ rejectUnauthorized: false });
		requestConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
	}

	let buffer;
	try {
		const response = await axios(requestConfig);
		buffer = Buffer.from(response.data, 'binary');
	} catch (ex) {
		if (ex.response) {
			// request was made, but server responded with an error status code
			throw new Error('StatusCodeError: ' + ex.response.status);
		} else {
			// something else went wrong, rethrow
			throw ex;
		}
	}
	return buffer;
}

function checkFile(path) {
	return fs.existsSync(path);
}

function logPayloadResult(payload, errorMessage) {
	const messageBits = [
		errorMessage ? chalk.red('✗') : chalk.green('✓'),
		chalk.gray(`[${payload.type}]`),
		payload.name
	];
	if (errorMessage) {
		messageBits.push(chalk.red(`(${errorMessage})`));
	}

	console.log(messageBits.join(' '));
}
