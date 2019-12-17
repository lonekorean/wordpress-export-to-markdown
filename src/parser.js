const fs = require('fs');
const luxon = require('luxon');
const xml2js = require('xml2js');

const shared = require('./shared');
const translator = require('./translator');

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
	turndownService = translator.initTurndownService();

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
			content: translator.getPostContent(post, turndownService, config)
		}));
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
