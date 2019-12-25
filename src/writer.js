const chalk = require('chalk');
const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const requestPromiseNative = require('request-promise-native');

const shared = require('./shared');

async function writeFilesPromise(posts, config) {
    await writeMarkdownFilesPromise(posts);
    await writeImageFilesPromise(posts, config);
}

async function writeMarkdownFilesPromise(posts) {
	console.log('\nSaving posts...');
    const promises = posts.map(writeMardownFilePromise);
	const result = await Promise.allSettled(promises);
	const failedCount = results.filter(result => result.status === 'rejected').length;
	if (failedCount === 0) {
		console.log('Done, got them all!');
	} else {
		console.log('Done, but with ' + chalk.red(failedCount + ' failed') + '.');
	}
}

async function writeMardownFilePromise(post) {
    const postDir = getPostDir(post, config);
    await createDirPromise(postDir);

    let output = '---\n';
    Object.entries(post.frontmatter).forEach(pair => {
        const key = pair[0];
        const value = pair[1].replace(/"/g, '\\"');
        output += key + ': "' + value + '"\n';
    });
    output += '---\n\n' + post.content + '\n';
    
    const postPath = path.join(postDir, getPostFilename(post, config));
    await fs.promises.writeFile(postPath, output);
}

async function writeImageFilesPromise(posts, config) {
	// collect image data from all posts into a single flattened array
    let delay = 0;
    let images = posts.flatMap(post => {
        const postDir = getPostDir(post, config);
        return post.meta.imageUrls.map(imageUrl => ({
            postDir,
			url: imageUrl,
			filename: shared.getFilenameFromUrl(imageUrl),
            delay: delay += 25
        }));
    });

    let progress = {
        current: 1,
        total: images.length
    };

	console.log('\nSaving images...');
    const promises = images.map(writeImageFileDelayPromise.bind(this, progress));
	const results = await Promise.allSettled(promises);
	const failedCount = results.filter(result => result.status === 'rejected').length;
	if (failedCount === 0) {
		console.log('Done, got them all!');
	} else {
		console.log('Done, but with ' + chalk.red(failedCount + ' failed') + '.');
	}
}

async function writeImageFileDelayPromise(progress, image) {
    await new Promise((resolve, reject) => {
        setTimeout(async () => {
			try {
				await writeImageFilePromise(image);
				console.log(chalk.green('[OK]') + ' ' + image.filename);
				resolve();
			} catch (ex) {
				console.error(chalk.red('[FAILED]') + ' ' + image.filename + ' ' + chalk.red('(' + ex.toString() + ')'));
				reject();
			} finally {
				progress.current++;
			}
        }, image.delay);
    });
}

async function writeImageFilePromise(image) {
	const imageDir = path.join(image.postDir, 'images');
	await createDirPromise(imageDir);

	const imagePath = path.join(imageDir, image.filename);
	const stream = fs.createWriteStream(imagePath);

	let buffer;
	try {
		buffer = await requestPromiseNative.get({
			url: image.url,
			encoding: null // preserves binary encoding
		});
	} catch (ex) {
		if (ex.name === 'StatusCodeError') {
			// these errors contain a lot of noise, simplify to just the status code
			ex.message = ex.statusCode;
		}
		throw ex;
	}
	
	stream.write(buffer);
}

async function createDirPromise(dir) {
	return fs.promises.mkdir(dir, { recursive: true });
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
