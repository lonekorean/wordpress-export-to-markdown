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
	const promises = payloads.map((payload) => new Promise((resolve, reject) => {
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
	const failedCount = results.filter((result) => result.status === 'rejected').length;
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
	let existingCount = 0;
	let delay = 0;
	const payloads = posts.flatMap((post) => {
		const destinationPath = shared.buildPostPath(post);
		if (checkFile(destinationPath)) {
			// already exists, don't need to save again
			existingCount++;
			return [];
		} else {
			const payload = {
				item: post,
				type: post.type,
				name: shared.getSlugWithFallback(post),
				destinationPath,
				delay
			};
			delay += shared.config.writeDelay;
			return [payload];
		}
	});

	logSavingMessage('posts', existingCount, payloads.length);
	if (payloads.length > 0) {
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
			if (shared.config.dateFormat) {
				outputValue = value.toFormat(shared.config.dateFormat);
			} else {
				outputValue = shared.config.includeTime ? value.toISO() : value.toISODate();
			}

			if (shared.config.quoteDate) {
				outputValue = `"${outputValue}"`;
			}
		} else if (typeof value === 'boolean') {
			// output unquoted
			outputValue = value.toString();
		} else if (value !== null && typeof value === 'object') {
			// Nested objects → YAML mappings
			outputValue = ""
			for (const [subKey, subVal] of Object.entries(value)) {
			  outputValue += `\n  ${subKey}: ${subVal}`
			}
		} else if (typeof value === 'string' && value.includes('\n')) {
			// Multi-line strings → literal block
			// outputValue = `${key}: |\n`
			value.split('\n').forEach(line => {
				outputValue += `  ${line}\n`
			})
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

	// for each post.metaContent object attribute, append to output
	Object.entries(post.metaContent).forEach(([key, value]) => {
		output += `\n\n::${key}\n${value}\n::\n`;
	});

	return output;
}

async function writeImageFilesPromise(posts) {
	// collect image data from all posts into a single flattened array of payloads
	let existingCount = 0;
	let delay = 0;
	const payloads = posts.flatMap((post) => {
		const postPath = shared.buildPostPath(post);
		const imagesDir = path.join(path.dirname(postPath), 'images');
		return post.imageUrls.flatMap((imageUrl) => {
			const filename = shared.getFilenameFromUrl(imageUrl);
			const destinationPath = path.join(imagesDir, filename);
			if (checkFile(destinationPath)) {
				// already exists, don't need to save again
				existingCount++;
				return [];
			} else {
				const payload = {
					item: imageUrl,
					type: 'image',
					name: filename,
					destinationPath,
					delay
				};
				delay += shared.config.requestDelay;
				return [payload];
			}
		});
	});

	logSavingMessage('images', existingCount, payloads.length);
	if (payloads.length > 0) {
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

	const response = await axios(requestConfig);
	const buffer = Buffer.from(response.data, 'binary');

	return buffer;
}

function checkFile(path) {
	return fs.existsSync(path);
}

function logSavingMessage(things, existingCount, remainingCount) {
	shared.logHeading(`Saving ${things}`);
	if (existingCount + remainingCount === 0) {
		console.log(`No ${things} to save.`);
	} else if (existingCount === 0) {
		console.log(`${remainingCount} ${things} to save.`);
	} else if (remainingCount === 0) {
		console.log(`All ${existingCount} ${things} already saved.`);
	} else {
		console.log(`${existingCount} ${things} already saved, ${remainingCount} remaining.`);
	}
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
