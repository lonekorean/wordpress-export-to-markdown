const fs = require('fs');
const requireDirectory = require('require-directory');
const xml2js = require('xml2js');

const shared = require('./shared');
const settings = require('./settings');
const translator = require('./translator');

// dynamically requires all frontmatter getters
const frontmatterGetters = requireDirectory(module, './frontmatter', { recurse: false });

async function parseFilePromise(config) {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(config.input, 'utf8');
	const allData = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});
	const channelData = allData.rss.channel[0].item;

	const postTypes = getPostTypes(channelData, config);
	const posts = collectPosts(channelData, postTypes, config);

	const images = [];
	if (config.saveAttachedImages) {
		images.push(...collectAttachedImages(channelData));
	}
	if (config.saveScrapedImages) {
		images.push(...collectScrapedImages(channelData, postTypes));
	}

	mergeImagesIntoPosts(images, posts);
	populateFrontmatter(posts);

	return posts;
}

function getPostTypes(channelData, config) {
	if (config.includeOtherTypes) {
		// search export file for all post types minus some default types we don't want
		// effectively this will be 'post', 'page', and custom post types
		const types = channelData
			.map(item => item.post_type[0])
			.filter(type => !['attachment', 'revision', 'nav_menu_item', 'custom_css', 'customize_changeset'].includes(type));
		return [...new Set(types)]; // remove duplicates
	} else {
		// just plain old vanilla "post" posts
		return ['post'];
	}
}

function getItemsOfType(channelData, type) {
	return channelData.filter(item => item.post_type[0] === type);
}

function collectPosts(channelData, postTypes, config) {
	// this is passed into getPostContent() for the markdown conversion
	const turndownService = translator.initTurndownService();

	let allPosts = [];
	postTypes.forEach(postType => {
		const postsForType = getItemsOfType(channelData, postType)
			.filter(postData => postData.status[0] !== 'trash' && postData.status[0] !== 'draft')
			.map(postData => ({
				// raw post data, used by frontmatter getters
				data: postData,

				// meta data isn't written to file, but is used to help with other things
				meta: {
					id: getPostId(postData),
					slug: getPostSlug(postData),
					coverImageId: getPostCoverImageId(postData),
					coverImage: undefined, // possibly set later in mergeImagesIntoPosts()
					type: postType,
					imageUrls: [] // possibly set later in mergeImagesIntoPosts()
				},

				// contents of the post in markdown
				content: translator.getPostContent(postData, turndownService, config)
			}));

		if (postTypes.length > 1) {
			console.log(`${postsForType.length} "${postType}" posts found.`);
		}

		allPosts.push(...postsForType);
	});

	if (postTypes.length === 1) {
		console.log(allPosts.length + ' posts found.');
	}
	return allPosts;
}

function getPostId(postData) {
	return postData.post_id[0];
}

function getPostSlug(postData) {
	return decodeURIComponent(postData.post_name[0]);
}

function getPostCoverImageId(postData) {
	if (postData.postmeta === undefined) {
		return undefined;
	}

	const postmeta = postData.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	const id = postmeta ? postmeta.meta_value[0] : undefined;
	return id;
}

function collectAttachedImages(channelData) {
	const images = getItemsOfType(channelData, 'attachment')
		// filter to certain image file types
		.filter(attachment => attachment.attachment_url && (/\.(gif|jpe?g|png|webp)$/i).test(attachment.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(channelData, postTypes) {
	const images = [];
	postTypes.forEach(postType => {
		getItemsOfType(channelData, postType).forEach(postData => {
			const postId = postData.post_id[0];
			const postContent = postData.encoded[0];
			const postLink = postData.link[0];

			const matches = [...postContent.matchAll(/<img[^>]*src="(.+?\.(?:gif|jpe?g|png|webp))"[^>]*>/gi)];
			matches.forEach(match => {
				// base the matched image URL relative to the post URL
				const url = new URL(match[1], postLink).href;
				images.push({
					id: -1,
					postId: postId,
					url
				});
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
}

function mergeImagesIntoPosts(images, posts) {
	images.forEach(image => {
		posts.forEach(post => {
			let shouldAttach = false;

			// this image was uploaded as an attachment to this post
			if (image.postId === post.meta.id) {
				shouldAttach = true;
			}

			// this image was set as the featured image for this post
			if (image.id === post.meta.coverImageId) {
				shouldAttach = true;
				post.meta.coverImage = shared.getFilenameFromUrl(image.url);
			}

			if (shouldAttach && !post.meta.imageUrls.includes(image.url)) {
				post.meta.imageUrls.push(image.url);
			}
		});
	});
}

function populateFrontmatter(posts) {
	posts.forEach(post => {
		const frontmatter = {};
		settings.frontmatter_fields.forEach(field => {
			[key, alias] = field.split(':');

			let frontmatterGetter = frontmatterGetters[key];
			if (!frontmatterGetter) {
				throw `Could not find a frontmatter getter named "${key}".`;
			}

			frontmatter[alias || key] = frontmatterGetter(post);
		});
		post.frontmatter = frontmatter;
	});
}

exports.parseFilePromise = parseFilePromise;
