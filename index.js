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
	const processors = { tagNameProcessors: [xml2js.processors.stripPrefix] };
	xml2js.parseString(content, processors, (err, data) => {
		if (err) {
			console.log('Unable to parse file content.');
			console.log(err);
		} else {
			processData(data);
		}
	});
}


function collectAuthors(data) {
	return data.rss.channel[0].author.map(item => ({
		id: item.author_login[0],
		name: item.author_display_name[0]
	}));
}


function processData(data) {
	let images = collectImages(data);
	let authors = collectAuthors(data);
	let posts = collectPosts(data, authors);
	mergeImagesIntoPosts(images, posts);
	writeFiles(posts);
}

function collectImages(data) {
	// start by collecting all attachment images
	let images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpg|jpeg|png)$/i).test(attachment.attachment_url[0]))
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
	let regex = (/<img[^>]*src="(.+?\.(?:gif|jpg|jpeg|png))"[^>]*>/gi);
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

function collectPosts(data, authors) {
	// this is passed into getPostContent() for the markdown conversion
	turndownService = initTurndownService();

	return getItemsOfType(data, 'post')
		.map(post => ({
			// meta data isn't written to file, but is used to help with other things
			meta: {
				id: getPostId(post),
				slug: getPostSlug(post),
				coverImageId: getPostCoverImageId(post),
			},
			frontmatter: {
				title: getPostTitle(post),
				author: getAuthorName(authors, getPostAuthor(post)),
				date: getPostDate(post),
				categories: getCategories(post),
				tags: getTags(post)
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

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let before = '\n\n';
			let src = node.getAttribute('src');
			if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
				// keep twitter and codepen <script> tags snug with the element above them
				before = '\n';
			}
			let html = node.outerHTML.replace('async=""', 'async');
			return before + html + '\n\n';
		}
	});

	// preserve iframes (common for embedded audio/video)
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			let html = node.outerHTML
				.replace('allowfullscreen=""', 'allowfullscreen');
			return '\n\n' + html + '\n\n';
		}
	});

	return turndownService;
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function getAuthorName(authors, id) {
	return authors.find(item => item.id == id).name;
}

function getPostAuthor(post) {
	return post.creator[0];
}
function getCategories(post) {
	let categories = [];
	post.category.forEach(c => {
		if (c.$.domain == "category") {
			categories.push(c._.toLowerCase().trim());
		}
	})
	return categories.join(",");
}

function getTags(post) {
	let tags = [];
	post.category.forEach(c => {
		if (c.$.domain == "post_tag") {
			tags.push(c._.toLowerCase().trim());
		}
	})
	return tags;
}

function getPostId(post) {
	return post.post_id[0];
}

function getPostCoverImageId(post) {
	if (post.postmeta === undefined) return;
	let postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	let id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostSlug(post) {
	return post.post_name[0];
}

function getPostTitle(post) {
	return post.title[0].trim();
}

function getPostDate(post) {
	return luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' }).toISODate();
}

function getPostContent(post, turndownService) {
	let content = post.encoded[0].trim();

	// insert an empty div element between double line breaks
	// this nifty trick causes turndown to keep adjacent paragraphs separated
	// without mucking up content inside of other elemnts (like <code> blocks)
	content = content.replace(/(\r?\n){2}/g, '\n<div></div>\n');

	if (argv.addcontentimages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^\/"]+\.(?:gif|jpg|jpeg|png))("[^>]*>)/gi, '$1images/$2$3');
	}

	// this is a hack to make <iframe> nodes non-empty by inserting a "." which
	// allows the iframe rule declared in initTurndownService() to take effect
	// (using turndown's blankRule() and keep() solution did not work for me)
	content = content.replace(/(<\/iframe>)/gi, '.$1');

	// use turndown to convert HTML to Markdown
	content = turndownService.turndown(content);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	// clean up the "." from the iframe hack above
	content = content.replace(/\.(<\/iframe>)/gi, '$1');

	return content;
}

function mergeImagesIntoPosts(images, posts) {
	// create lookup table for quicker traversal
	let postsLookup = posts.reduce((lookup, post) => {
		lookup[post.meta.id] = post;
		return lookup;
	}, {});

	images.forEach(image => {
		let post;
		if (image.postId == 0) {
			//sometime the cover image post id could be 0
			post = posts.filter(o => o.meta.coverImageId == image.id)[0];
		} else {
			post = postsLookup[image.postId];
		} 
		if (post) {
			// save full image URLs for downloading later
			post.meta.imageUrls = post.meta.imageUrls || [];
			post.meta.imageUrls.push(image.url);

			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = "images/" + getFilenameFromUrl(image.url);
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
			.get(encodeURI(imageUrl))
			.on('response', response => {
				if (response.statusCode !== 200) {
					console.log('Response status code ' + response.statusCode + ' received for ' + imageUrl + '.');
				}
			})
			.on('error', err => {
				console.log('Unable to download image.',imageUrl);
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
