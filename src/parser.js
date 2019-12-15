const fs = require('fs');
const luxon = require('luxon');
const turndown = require('turndown');
const xml2js = require('xml2js');

const shared = require('./shared');

let config;

async function parseFilePromise(configIn) {
	const content = fs.readFileSync(configIn.input, 'utf8');

	const processors = { tagNameProcessors: [xml2js.processors.stripPrefix] };
	const data = await xml2js.parseStringPromise(content, processors);

	config = configIn;

	let posts = processData(data);
	return Promise.resolve(posts);
}

function processData(data) {
	let images = collectImages(data);
	let posts = collectPosts(data);
	mergeImagesIntoPosts(images, posts);
	return posts;
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
	if (config.addcontentimages) {
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
	return post.title[0].trim().replace(/"/g, '\\"');
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

	if (config.addcontentimages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^\/"]+\.(?:gif|jpg|png))("[^>]*>)/gi, '$1images/$2$3');
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
		let post = postsLookup[image.postId];
		if (post) {
			// save full image URLs for downloading later
			post.meta.imageUrls = post.meta.imageUrls || [];
			post.meta.imageUrls.push(image.url);

			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = shared.getFilenameFromUrl(image.url);
			}
		}
	});
}

exports.parseFilePromise = parseFilePromise;