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
    const promises = posts.map(writeMardownFilePromise);
    const result = await Promise.allSettled(promises);
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
            delay: delay += 25
        }));
    });

    let progress = {
        current: 0,
        total: images.length
    };

    const promises = images.map(writeImageFileDelayPromise.bind(this, progress));
    const result = await Promise.allSettled(promises);
}

async function writeImageFileDelayPromise(progress, image) {
    await new Promise((resolve, reject) => {
        setTimeout(async () => {
            await writeImageFilePromise(progress, image);
            resolve();
        }, image.delay);
    });
}

async function writeImageFilePromise(progress, image) {
    const imageDir = path.join(image.postDir, 'images');
    await createDirPromise(imageDir);

    const imagePath = path.join(imageDir, shared.getFilenameFromUrl(image.url));
	const stream = fs.createWriteStream(imagePath);

    try {
        const buffer = await requestPromiseNative.get({
            url: image.url,
            encoding: null // preserves binary encoding
        });
        stream.write(buffer);
    } catch(ex) {
        if (ex.statusCode !== undefined && ex.statusCode !== 200) {
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write('Response status code ' + ex.statusCode + ' received for ' + image.url + '.\n');
        } else {
            console.log(ex);
        }
    } finally {
        progress.current++;
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write('Saving images: ' + progress.current + ' / ' + progress.total);
    }
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
