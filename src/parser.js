const fs = require('fs');
const luxon = require('luxon');
const xml2js = require('xml2js');

const shared = require('./shared');
const translator = require('./translator');

async function parseFilePromise(config) {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(config.input, 'utf8');
	const data = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});

	let posts = collectPosts(data, config);

	let images = [];
	if (config.saveAttachedImages) {
		images.push(...collectAttachedImages(data));
	}
	if (config.saveScrapedImages) {
		images.push(...collectScrapedImages(data));
	}

	mergeImagesIntoPosts(images, posts);

	return posts;
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function collectPosts(data, config) {
	// this is passed into getPostContent() for the markdown conversion
	turndownService = translator.initTurndownService();

	let posts = getItemsOfType(data, 'post')
		.map(post => ({
			// meta data isn't written to file, but is used to help with other things
			meta: {
				id: getPostId(post),
				slug: getPostSlug(post),
				coverImageId: getPostCoverImageId(post),
				imageUrls: []
			},
			frontmatter: {
				title: getPostTitle(post),
				date: getPostDate(post)
			},
			content: translator.getPostContent(post, turndownService, config)
		}));

	console.log(posts.length + ' posts found.');
	return posts;
}

function getPostId(post) {
	return post.post_id[0];
}

function getPostSlug(post) {
	return post.post_name[0];
}

function getPostCoverImageId(post) {
	if (post.postmeta === undefined) {
		return undefined;
	}

	let postmeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	let id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function getPostTitle(post) {
	return post.title[0];
}

function getPostDate(post) {
	return luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: 'utc' }).toISODate();
}

function collectAttachedImages(data) {
	let images = getItemsOfType(data, 'attachment')
		// filter to certain image file types
		.filter(attachment => (/\.(gif|jpe?g|png)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(data) {
	let images = [];
	getItemsOfType(data, 'post').forEach(post => {
		let postId = post.post_id[0];
		let postContent = post.encoded[0];
		let postLink = post.link[0];

		let matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png))"[^>]*>/gi)];
		matches.forEach(match => {
			// base the matched image URL relative to the post URL
			let url = new URL(match[1], postLink).href;

			images.push({
				id: -1,
				postId: postId,
				url: url
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
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
			if (image.id === post.meta.coverImageId) {
				// save cover image filename to frontmatter
				post.frontmatter.coverImage = shared.getFilenameFromUrl(image.url);
			}
			
			// save (unique) full image URLs for downloading later
			if (!post.meta.imageUrls.includes(image.url)) {
				post.meta.imageUrls.push(image.url);
			}
		}
	});
}

exports.parseFilePromise = parseFilePromise;
