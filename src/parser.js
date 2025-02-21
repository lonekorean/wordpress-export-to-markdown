import fs from 'fs';
import * as luxon from 'luxon';
import * as data from './data.js';
import * as frontmatter from './frontmatter.js';
import * as shared from './shared.js';
import * as translator from './translator.js';

export async function parseFilePromise() {
	console.log('\nParsing...');
	const content = await fs.promises.readFile(shared.config.input, 'utf8');
	const rssData = await data.load(content);

	const channelData = rssData.getSingle('channel', 0);
	const allPostData = channelData.getAll('item');

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
	const postTypes = allPostData
		.map((postData) => postData.getSingle('post_type', 0).value)
		.filter((postType) => ![
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
		].includes(postType));
	return [...new Set(postTypes)]; // remove duplicates
}

function getItemsOfType(allPostData, type) {
	return allPostData.filter(item => item.getSingle('post_type', 0).value === type);
}

function collectPosts(allPostData, postTypes) {
	let allPosts = [];
	postTypes.forEach(postType => {
		const postsForType = getItemsOfType(allPostData, postType)
			.filter(postData => postData.getSingle('status', 0).value !== 'trash')
			.filter(postData => !(postType === 'page' && postData.getSingle('post_name', 0).value === 'sample-page'))
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
		content: translator.getPostContent(data.getSingle('encoded', 0).value),

		// particularly useful values for all sorts of things
		type: data.getSingle('post_type', 0).value,
		id: data.getSingle('post_id', 0).value,
		isDraft: data.getSingle('status', 0).value === 'draft',
		slug: decodeURIComponent(data.getSingle('post_name', 0).value),
		date: getPostDate(data),
		coverImageId: getPostMetaValue(data, '_thumbnail_id'),

		// these are possibly set later in mergeImagesIntoPosts()
		coverImage: undefined,
		imageUrls: []
	};
}

function getPostDate(data) {
	const date = luxon.DateTime.fromRFC2822(data.getSingle('pubDate', 0).value ?? '', { zone: shared.config.customDateTimezone });
	return date.isValid ? date : undefined;
}

function getPostMetaValue(data, key) {
	const metas = data.getAll('postmeta', false) ?? [];
	const meta = metas.find((meta) => meta.getSingle('meta_key', 0).value === key);
	return meta ? meta.getSingle('meta_value', 0).value : undefined;
}

function collectAttachedImages(allPostData) {
	const images = getItemsOfType(allPostData, 'attachment')
		// filter to certain image file types
		.filter(attachment => {
			const url = attachment.getSingle('attachment_url', 0).value;
			return url && (/\.(gif|jpe?g|png|webp)$/i).test(url);
		})
		.map(attachment => ({
			id: attachment.getSingle('post_id', 0).value,
			postId: attachment.getSingle('post_parent', 0).value,
			url: attachment.getSingle('attachment_url', 0).value
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(allPostData, postTypes) {
	const images = [];
	postTypes.forEach(postType => {
		getItemsOfType(allPostData, postType).forEach(postData => {
			const postId = postData.getSingle('post_id', 0).value;
			const postContent = postData.getSingle('encoded', 0).value;
			const postLink = postData.getSingle('link', 0).value;

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

