import fs from 'fs';
import * as luxon from 'luxon';
import xml2js from 'xml2js';
import * as frontmatter from './frontmatter.js';
import * as shared from './shared.js';
import * as translator from './translator.js';

export async function parseFilePromise() {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(shared.config.input, 'utf8');
	const allData = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	});
	const channelData = allData.rss.channel[0].item;

	const postTypes = getPostTypes(channelData);
	const posts = collectPosts(channelData, postTypes);

	const images = [];
	if (shared.config.saveImages === 'attached' || shared.config.saveImages === 'all') {
		images.push(...collectAttachedImages(channelData));
	}
	if (shared.config.saveImages === 'scraped' || shared.config.saveImages === 'all') {
		images.push(...collectScrapedImages(channelData, postTypes));
	}

	mergeImagesIntoPosts(images, posts);
	populateFrontmatter(posts);

	return posts;
}

function getPostTypes(channelData) {
	// search export file for all post types minus some specific types we don't want
	const types = channelData
		.map(item => item.post_type[0])
		.filter(type => ![
			'attachment',
			'revision',
			'nav_menu_item',
			'custom_css',
			'customize_changeset',
			'wp_global_styles',
			'wp_navigation'
		].includes(type));
	return [...new Set(types)]; // remove duplicates
}

function getItemsOfType(channelData, type) {
	return channelData.filter(item => item.post_type[0] === type);
}

function collectPosts(channelData, postTypes) {
	// this is passed into getPostContent() for the markdown conversion
	const turndownService = translator.initTurndownService();

	let allPosts = [];
	postTypes.forEach(postType => {
		const postsForType = getItemsOfType(channelData, postType)
			.filter(postData => postData.status[0] !== 'trash')
			.filter(postData => !(postType === 'page' && postData.post_name[0] === 'sample-page'))
			.map(postData => buildPost(postData, turndownService));

		if (postsForType.length > 0) {
			console.log(`${postsForType.length} posts of type "${postType}" found.`);
		}

		allPosts.push(...postsForType);
	});

	return allPosts;
}

function buildPost(data, turndownService) {
	return {
		// full raw post data
		data,

		// contents of the post in markdown
		content: translator.getPostContent(data, turndownService),

		// these are not written to file, but help with other things
		type: data.post_type[0],
		id: data.post_id[0],
		isDraft: data.status[0] === 'draft',
		slug: decodeURIComponent(data.post_name[0]),
		date: data.pubDate[0] ? luxon.DateTime.fromRFC2822(data.pubDate[0], { zone: shared.config.customDateTimezone }) : undefined,
		coverImageId: getPostMetaValue(data.postmeta, '_thumbnail_id'),

		// these are possibly set later in mergeImagesIntoPosts()
		coverImage: undefined,
		imageUrls: []
	};
}

function getPostMetaValue(metas, key) {
	const meta = metas && metas.find((meta) => meta.meta_key[0] === key);
	return meta ? meta.meta_value[0] : undefined;
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
			if (image.postId === post.id) {
				shouldAttach = true;
			}

			// this image was set as the featured image for this post
			if (image.id === post.coverImageId) {
				shouldAttach = true;
				post.coverImage = shared.getFilenameFromUrl(image.url);
			}

			if (shouldAttach && !post.imageUrls.includes(image.url)) {
				post.imageUrls.push(image.url);
			}
		});
	});
}

function populateFrontmatter(posts) {
	posts.forEach(post => {
		post.frontmatter = {};
		shared.config.frontmatterFields.forEach(field => {
			const [key, alias] = field.split(':');

			let frontmatterGetter = frontmatter[key];
			if (!frontmatterGetter) {
				throw `Could not find a frontmatter getter named "${key}".`;
			}

			post.frontmatter[alias ?? key] = frontmatterGetter(post);
		});
	});
}

