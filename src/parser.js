import chalk from 'chalk';
import fs from 'fs';
import * as luxon from 'luxon';
import * as data from './data.js';
import * as frontmatter from './frontmatter.js';
import * as shared from './shared.js';
import * as translator from './translator.js';
import { unserialize } from 'php-serialize'

export async function parseFilePromise() {
	shared.logHeading('Parsing');
	const content = await fs.promises.readFile(shared.config.input, 'utf8');
	const rssData = await data.load(content);
	const allPostData = rssData.child('channel').children('item');

	let postTypes = getPostTypes(allPostData);

	if (shared.config.postTypes?.length) {
		postTypes = postTypes.filter((postType) =>
			shared.config.postTypes.includes(postType)
		);
	}

	if (shared.config.excludePostTypes?.length) {
		postTypes = postTypes.filter((postType) =>
			! shared.config.postTypes.includes(postType)
		);
	}

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
	const postTypes = [...new Set(allPostData // new Set() is used to dedupe array
		.map((postData) => postData.childValue('post_type'))
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
		].includes(postType))
	)];

	// change order to "post", "page", then all custom post types (alphabetically)
	prioritizePostType(postTypes, 'page');
	prioritizePostType(postTypes, 'post');

	return postTypes;
}

function getItemsOfType(allPostData, type) {
	return allPostData.filter((item) => item.childValue('post_type') === type);
}

function collectPosts(allPostData, postTypes) {
	let allPosts = [];
	postTypes.forEach((postType) => {
		const postsForType = getItemsOfType(allPostData, postType)
			.filter((postData) => postData.childValue('status') !== 'trash')
			.filter((postData) => !(postType === 'page' && postData.childValue('post_name') === 'sample-page'))
			.map((postData) => buildPost(postData));

		if (postsForType.length > 0) {
			if (postType === 'post') {
				console.log(`${postsForType.length} normal posts found.`);
			} else if (postType === 'page') {
				console.log(`${postsForType.length} pages found.`);
			} else {
				console.log(`${postsForType.length} custom "${postType}" posts found.`);
			}
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
		content: translator.getPostContent(data.childValue('encoded')),

		// particularly useful values for all sorts of things
		type: data.childValue('post_type'),
		id: data.childValue('post_id'),
		isDraft: data.childValue('status') === 'draft',
		slug: decodeURIComponent(data.childValue('post_name')),
		date: getPostDate(data),
		coverImageId: getPostMetaValue(data, '_thumbnail_id'),

		// these are possibly set later in mergeImagesIntoPosts()
		coverImage: undefined,
		imageUrls: [],

		metaContent: Object.fromEntries(
  		shared.config.appendMeta.map((field) => {
        const [key, alias] = field.split(':');
        const value = getPostMetaValue(data, key);
        if (value !== undefined && value !== null && value !== '') {
          // treat the value
          return [alias ?? key, translator.getPostContent(value)];
        }
      }).filter(x => x)
		)
	};
}

function getPostDate(data) {
	const date = luxon.DateTime.fromRFC2822(data.childValue('pubDate'), { zone: shared.config.timezone });
	return date.isValid ? date : undefined;
}

function getPostMetaValue(data, key) {
	const metas = data.children('postmeta');
	const meta = metas.find((meta) => meta.childValue('meta_key') === key);

	const raw = meta ? meta.childValue('meta_value') : undefined;

	// If it looks like a PHP-serialized array/object, deserialize it
  if (typeof raw === 'string' && /^a:\d+:/.test(raw.trim())) {
    try {
      // Note: you must have installed `php-serialize`
      const parsed = unserialize(raw)
      return parsed
    } catch (e) {
      // fallback to the raw string if unserialization fails
      console.log(`Failed to unserialize meta value for key "${key}": ${raw}`);
    }
  }

	return raw;
}

function collectAttachedImages(allPostData) {
	const images = getItemsOfType(allPostData, 'attachment')
		// filter to certain image file types
		.filter((attachment) => {
			const url = attachment.childValue('attachment_url');
			return url && (/\.(gif|jpe?g|png|webp)(\?|$)/i).test(url);
		})
		.map((attachment) => ({
			id: attachment.childValue('post_id'),
			postId: attachment.optionalChildValue('post_parent') ?? 'nope', // may not exist (cover image in a squarespace export, for example)
			url: attachment.childValue('attachment_url')
		}));

	console.log(images.length + ' attached images found.');
	return images;
}

function collectScrapedImages(allPostData, postTypes) {
	const images = [];
	postTypes.forEach((postType) => {
		getItemsOfType(allPostData, postType).forEach((postData) => {
			const postId = postData.childValue('post_id');

			const postContent = postData.childValue('encoded');
			const scrapedUrls = [...postContent.matchAll(/<img(?=\s)[^>]+?(?<=\s)src="(.+?)"[^>]*>/gi)].map((match) => match[1]);
			scrapedUrls.forEach((scrapedUrl) => {
				let url;
				if (isAbsoluteUrl(scrapedUrl)) {
					url = scrapedUrl;
				} else {
					const postLink = postData.childValue('link');
					if (isAbsoluteUrl(postLink)) {
						url = new URL(scrapedUrl, postLink).href;
					} else {
						throw new Error(`Unable to determine absolute URL from scraped image URL '${scrapedUrl}' and post link URL '${postLink}'.`);
					}
				}

				images.push({
					id: 'nope', // scraped images don't have an id
					postId,
					url
				});
			});
		});
	});

	console.log(images.length + ' images scraped from post body content.');
	return images;
}

function mergeImagesIntoPosts(images, posts) {
	images.forEach((image) => {
		posts.forEach((post) => {
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
	posts.forEach((post) => {
		post.frontmatter = {};
		shared.config.frontmatterFields.forEach((field) => {
			const [key, alias] = field.split(':');

			let frontmatterGetter = frontmatter[key];
			if (!frontmatterGetter) {
				throw `Could not find a frontmatter getter named "${key}".`;
			}

			post.frontmatter[alias ?? key] = frontmatterGetter(post);
		});


		// Handling for meta fields
    shared.config.frontmatterMeta.forEach((field) => {
      const [key, alias] = field.split(':');
      const value = getPostMetaValue(post.data, key);
      if (value !== undefined && value !== null && value !== '') {
        post.frontmatter[alias ?? key] = value;
      }
    });
	});
}

function prioritizePostType(postTypes, postType) {
	const index = postTypes.indexOf(postType);
	if (index !== -1) {
		postTypes.splice(index, 1);
		postTypes.unshift(postType);
	}
}

function isAbsoluteUrl(url) {
	return (/^https?:\/\//i).test(url);
}
