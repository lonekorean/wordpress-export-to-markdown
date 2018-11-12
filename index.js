const fs = require('fs');
const luxon = require('luxon');
const minimist = require('minimist');
const path = require('path');
const request = require('request');
const turndown = require('turndown');
const xml2js = require('xml2js');

// global so various functions can access arguments
let argv;

function init() {
	argv = minimist(process.argv.slice(2), {
		string: [
			'input',
			'output'
		],
		boolean: [
			'yearmonthfolders',
			'yearfolders',
			'postfolders',
			'prefixdate',
			'saveimages',
			'addcontentimages'
		],
		default: {
			input: 'export.xml',
			output: 'output',
			yearmonthfolders: false,
			yearfolders: false,
			postfolders: true,
			prefixdate: false,
			saveimages: true,
			addcontentimages: false
		}
	});

	let content = readFile(argv.input);
	parseFileContent(content);
}

function readFile(path) {
	try {
		return fs.readFileSync(path, 'utf8');
	} catch (ex) {
		console.log('Unable to read file.');
		console.log(ex.message);
	}
}

function parseFileContent(content) {
	const processors = { tagNameProcessors: [ xml2js.processors.stripPrefix ] };
	xml2js.parseString(content, processors, (err, data) => {
		if (err) {
			console.log('Unable to parse file content.');
			console.log(err);        
		} else {
			processData(data);
		}
	});
}

function processData(data) {
	let images = collectImages(data);
	let posts = collectPosts(data);
	mergeImagesIntoPosts(images, posts);
	writeFiles(posts);
}

function collectImages(data) {
	// start by collecting all attachment images
	let images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpg|png)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	// optionally add images scraped from <img> tags in post content
	if (argv.addcontentimages) {
		addContentImages(data, images);
	}

	return images;
}

function addContentImages(data, images) {
	let regex = (/<img[^>]*src="(.+?\.(?:gif|jpg|png))"[^>]*>/gi);
	let match;

	getItemsOfType(data, 'post').forEach(post => {
		let postId = post.post_id[0];
		let postContent = post.encoded[0];
		let postLink = post.link[0];

		// reset lastIndex since we're reusing the same regex object
		regex.lastIndex = 0;
		while ((match = regex.exec(postContent)) !== null) {
			// base the matched image URL relative to the post URL
			let url = new URL(match[1], postLink).href;

			// add image if it hasn't already been added for this post
			let exists = images.some(image => image.postId === postId && image.url === url);
			if (!exists) {
				images.push({
					id: -1,
					postId: postId,
					url: url
				});
				console.log('Scraped ' + url + '.');
			}
		}
	});	
}

function collectPosts(data) {
	// this is passed into getPostContent() for the markdown conversion
	turndownService = initTurndownService();

	return getItemsOfType(data, 'post')
		.map(post => ({
			// meta data isn't written to file, but is used to help with other things
			meta: {
				id: getPostId(post),
				slug: getPostSlug(post),
				coverImageId: getPostCoverImageId(post)
			},
			frontmatter: {
				title: getPostTitle(post),
				date: getPostDate(post)
			},
			content: getPostContent(post, turndownService)
		}));
}

function initTurndownService() {
	let turndownService = new turndown({
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced'
	});

	// preserve embedded scripts (for gists, codepens, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let html = node.outerHTML.replace('async=""', 'async');
			return '\n\n' + html + '\n\n';
		}
	});

	// preserve embedded codepens
	turndownService.addRule('p', {
		filter: node => node.nodeName === 'P' && node.attributes['data-pen-title'],
		replacement: (content, node) => '\n\n' + node.outerHTML + '\n\n'
	});

	// preserve iframes (common for embedded audio/video)
	// other solutions via blankRule() and keep() did not work for me
	// that's why getPostContent() adds a "." to make <iframe> non-empty
	// allowing this rule to take effect (and then clean up the ".")
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			let html = node.outerHTML
				.replace('allowfullscreen=""', 'allowfullscreen')
				.replace('.</iframe>', '</iframe>');
			return '\n\n' + html + '\n\n';
		}
	});

	
	return turndownService;
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function getPostId(post) {
	return post.post_id[0];
}

function getPostCoverImageId(post) {
	let postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	let id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostSlug(post) {
	return post.post_name[0];
}

function getPostTitle(post) {
	return post.title[0];
}

function getPostDate(post) {
	return luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' }).toISO();
}

function getPostContent(post, turndownService) {
	let content = post.encoded[0].trim();

	// this is for a workaround/hack in initTurndownService()
	content = content.replace(/<\/iframe>/gi, '.$&');

	if (argv.addcontentimages) {
		// writeImageFile() will save all content images to a relative /images folder
		// so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^\/"]+\.(?:gif|jpg|png))("[^>]*>)/gi, '$1images/$2$3');
	}

	content = turndownService.turndown(content)
		.replace(/-\s+/g, '- '); // clean up extra spaces

	return content;
}

function mergeImagesIntoPosts(images, posts) {
	// create lookup table for quicker traversal
	let postsLookup = posts.reduce((lookup, post) => {
		lookup[post.meta.id] = post;
		return lookup;
	}, {});

	images.forEach(image => {
		let post = postsLookup[image.postId];
		if (post) {
			// save full image URLs for downloading later
			post.meta.imageUrls = post.meta.imageUrls || [];
			post.meta.imageUrls.push(image.url);

			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = getFilenameFromUrl(image.url);
			}
		}
	});
}

function writeFiles(posts) {
	let delay = 0;
	posts.forEach(post => {
		const postDir = getPostDir(post);
		createDir(postDir);
		writeMarkdownFile(post, postDir);

		if (argv.saveimages && post.meta.imageUrls) {
			post.meta.imageUrls.forEach(imageUrl => {
				const imageDir = path.join(postDir, 'images');
				createDir(imageDir);
				writeImageFile(imageUrl, imageDir, delay);
				delay += 25;
			});
		}
	});
}

function writeMarkdownFile(post, postDir) {
	const frontmatter = Object.entries(post.frontmatter)
		.reduce((accumulator, pair) => {
			return accumulator + pair[0] + ': "' + pair[1] + '"\n'
		}, '');
	const data = '---\n' + frontmatter + '---\n\n' + post.content + '\n';
	
	const postPath = path.join(postDir, getPostFilename(post));
	fs.writeFile(postPath, data, (err) => {
		if (err) {
			console.log('Unable to write file.')
			console.log(err);
		} else {
			console.log('Wrote ' + postPath + '.');
		}
	});
}

function writeImageFile(imageUrl, imageDir, delay) {
	let imagePath = path.join(imageDir, getFilenameFromUrl(imageUrl));
	let stream = fs.createWriteStream(imagePath);
	stream.on('finish', () => {
		console.log('Saved ' + imagePath + '.');
	});

	// stagger image requests so we don't piss off hosts
	setTimeout(() => {
		request
			.get(imageUrl)
			.on('response', response => {
				if (response.statusCode !== 200) {
					console.log('Response status code ' + response.statusCode + ' received for ' + imageUrl + '.');
				}
			})
			.on('error', err => {
				console.log('Unable to download image.');
				console.log(err);
			})
			.pipe(stream);
	}, delay);
}

function getFilenameFromUrl(url) {
	return url.split('/').slice(-1)[0];
}

function createDir(dir) {
	try {
		fs.accessSync(dir, fs.constants.F_OK);
	} catch (ex) {
		fs.mkdirSync(dir, { recursive: true });
	}
}

function getPostDir(post) {
	let dir = argv.output;
	let dt = luxon.DateTime.fromISO(post.frontmatter.date);

	if (argv.yearmonthfolders) {
		dir = path.join(dir, dt.toFormat('yyyy'), dt.toFormat('LL'));
	} else if (argv.yearfolders) {
		dir = path.join(dir, dt.toFormat('yyyy'));
	}

	if (argv.postfolders) {
		let folder = post.meta.slug;
		if (argv.prefixdate) {
			folder = dt.toFormat('yyyy-LL-dd') + '-' + folder;
		}
		dir = path.join(dir, folder);
	}

	return dir;
}

function getPostFilename(post) {
	if (argv.postfolders) {
		// the containing folder name will be unique, just use index.md here
		return 'index.md';
	} else {
		let filename = post.meta.slug + '.md';
		if (argv.prefixdate) {
			let dt = luxon.DateTime.fromISO(post.frontmatter.date);
			filename = dt.toFormat('yyyy-LL-dd') + '-' + filename;
		}
		return filename;
	}
}

// it's go time!
init();
