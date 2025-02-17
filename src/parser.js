import fs from 'fs';
import * as luxon from 'luxon';
import xml2js from 'xml2js';
import * as frontmatter from './frontmatter.js';
import * as shared from './shared.js';
import * as translator from './translator.js';

export async function parseFilePromise() {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(shared.config.input, 'utf8');

	const rootData = await xml2js.parseStringPromise(content, {
		trim: true,
		tagNameProcessors: [xml2js.processors.stripPrefix]
	}).catch((ex) => {
		ex.message = 'Could not parse XML. This likely means your import file is malformed.\n\n' + ex.message;
		throw ex;
	});

	const rssData = rootData.rss;
	if (rssData === undefined) {
		throw new Error('Could not find <rss> root node. This likely means your import file is malformed.')
	}
	rssData['wetm-expression'] = 'rss';

	const channelData = shared.getValue(rssData, 'channel', 0);
	const allPostData = shared.getValue(channelData, 'item');

	const postTypes = getPostTypes(allPostData);
	const posts = collectPosts(allPostData, postTypes);

	const images = [];
	if (shared.config.saveImages === 'attached' || shared.config.saveImages === 'all') {
		images.push(...collectAttachedImages(allPostData));
	}
	if (shared.config.saveImages === 'scraped' || shared.config.saveImages === 'all') {
		images.push(...collectScrapedImages(allPostData, postTypes));
	}

	mergeImagesIntoPosts(images, posts);
	populateFrontmatter(posts);

	return posts;
}

function getPostTypes(allPostData) {
	// search export file for all post types minus some specific types we don't want
	const types = allPostData
		.map(item => shared.getValue(item, 'post_type', 0))
		.filter(type => ![
			'attachment',
			'revision',
			'nav_menu_item',
			'custom_css',
			'customize_changeset',
			'oembed_cache',
			'user_request',
			'wp_block',
			'wp_global_styles',
			'wp_navigation',
			'wp_template',
			'wp_template_part'
		].includes(type));
	return [...new Set(types)]; // remove duplicates
}

function getItemsOfType(allPostData, type) {
	return allPostData.filter(item => shared.getValue(item, 'post_type', 0) === type);
}

function collectPosts(allPostData, postTypes) {
	let allPosts = [];
	postTypes.forEach(postType => {
		const postsForType = getItemsOfType(allPostData, postType)
			.filter(postData => shared.getValue(postData, 'status', 0) !== 'trash')
			.filter(postData => !(postType === 'page' && shared.getValue(postData, 'post_name', 0) === 'sample-page'))
			.map(postData => buildPost(postData));

		if (postsForType.length > 0) {
			console.log(`${postsForType.length} posts of type "${postType}" found.`);
		}

		allPosts.push(...postsForType);
	});

	return allPosts;
}

function buildPost(data) {
	return {
		// full raw post data
		data,

		// body content converted to markdown
		content: translator.getPostContent(shared.getValue(data, 'encoded', 0)),

		// particularly useful values for all sorts of things
		type: shared.getValue(data, 'post_type', 0),
		id: shared.getValue(data, 'post_id', 0),
		isDraft: shared.getValue(data, 'status', 0) === 'draft',
		slug: decodeURIComponent(shared.getValue(data, 'post_name', 0)),
		date: getPostDate(data),
		coverImageId: getPostMetaValue(data, '_thumbnail_id'),

		// these are possibly set later in mergeImagesIntoPosts()
		coverImage: undefined,
		imageUrls: []
	};
}

function getPostDate(data) {
	const date = luxon.DateTime.fromRFC2822(shared.getValue(data, 'pubDate', 0) ?? '', { zone: shared.config.customDateTimezone });
	return date.isValid ? date : undefined;
}

function getPostMetaValue(data, key) {
	const metas = shared.getOptionalValue(data, 'postmeta');
	const meta = metas && metas.find((meta) => shared.getValue(meta, 'meta_key', 0) === key);
	return meta ? shared.getValue(meta, 'meta_value', 0) : undefined;
}

function collectAttachedImages(allPostData) {
	const images = getItemsOfType(allPostData, 'attachment')
		// filter to certain image file types
		.filter(attachment => {
			const url = shared.getOptionalValue(attachment, 'attachment_url', 0);
			return url && (/\.(gif|jpe?g|png|webp)$/i).test(url);
		})
		.map(attachment => ({
			id: shared.getValue(attachment, 'post_id', 0),
			postId: shared.getValue(attachment, 'post_parent', 0),
			url: shared.getValue(attachment, 'attachment_url', 0)
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(allPostData, postTypes) {
	const images = [];
	postTypes.forEach(postType => {
		getItemsOfType(allPostData, postType).forEach(postData => {
			const postId = shared.getValue(postData, 'post_id', 0);
			const postContent = shared.getValue(postData, 'encoded', 0);
			const postLink = shared.getValue(postData, 'link', 0);

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

