import chalk from 'chalk';
import fs from 'fs';
import * as luxon from 'luxon';
import * as data from './data.js';
import * as frontmatter from './frontmatter.js';
import * as shared from './shared.js';
import * as translator from './translator.js';

export async function parseFilePromise() {
	shared.logHeading('Parsing');
	const content = await fs.promises.readFile(shared.config.input, 'utf8');
	const rssData = await data.load(content);
	const channel = rssData.child('channel');
	const allPostData = channel.children('item');

	const taxonomies = collectTaxonomyMetadata(channel);

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

	return { posts, taxonomies };
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
	// collect custom taxonomy term slugs keyed by taxonomy slug
	const customTaxonomies = {};
	data.children('category')
		.filter((cat) => cat.attribute('domain') !== 'category' && cat.attribute('domain') !== 'post_tag')
		.forEach((cat) => {
			const domain = cat.attribute('domain');
			if (!customTaxonomies[domain]) {
				customTaxonomies[domain] = [];
			}
			customTaxonomies[domain].push(decodeURIComponent(cat.attribute('nicename')));
		});

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

		// custom taxonomy terms keyed by taxonomy slug
		customTaxonomies
	};
}

function getPostDate(data) {
	const date = luxon.DateTime.fromRFC2822(data.childValue('pubDate'), { zone: shared.config.timezone });
	return date.isValid ? date : undefined;
}

function getPostMetaValue(data, key) {
	const metas = data.children('postmeta');
	const meta = metas.find((meta) => meta.childValue('meta_key') === key);
	return meta ? meta.childValue('meta_value') : undefined;
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

		// inject custom taxonomy slugs into frontmatter, each taxonomy as its own field
		Object.entries(post.customTaxonomies).forEach(([domain, slugs]) => {
			if (slugs.length > 0) {
				if (post.frontmatter.hasOwnProperty(domain)) {
					console.warn(`⚠️  Skipping custom taxonomy '${domain}' on post '${post.slug}' because it conflicts with an existing frontmatter field.`);
					return;
				}
				post.frontmatter[domain] = slugs;
			}
		});
	});
}

function collectTaxonomyMetadata(channel) {
	const taxonomies = {};

	// channel-level <wp:category> elements (stripped to 'category')
	const wpCategories = channel.children('category');
	if (wpCategories.length > 0) {
		taxonomies.category = wpCategories.map((cat) => ({
			termId: parseInt(cat.optionalChildValue('term_id')),
			slug: cat.optionalChildValue('category_nicename'),
			name: cat.optionalChildValue('cat_name'),
			parent: cat.optionalChildValue('category_parent') || null,
			description: cat.optionalChildValue('category_description') || null
		}));
	}

	// channel-level <wp:tag> elements (stripped to 'tag')
	const wpTags = channel.children('tag');
	if (wpTags.length > 0) {
		taxonomies.post_tag = wpTags.map((tag) => ({
			termId: parseInt(tag.optionalChildValue('term_id')),
			slug: tag.optionalChildValue('tag_slug'),
			name: tag.optionalChildValue('tag_name'),
			description: tag.optionalChildValue('tag_description') || null
		}));
	}

	// channel-level <wp:term> elements (stripped to 'term') — custom taxonomies
	const wpTerms = channel.children('term');
	wpTerms.forEach((term) => {
		const taxonomy = term.optionalChildValue('term_taxonomy');
		if (!taxonomy || taxonomy === 'category' || taxonomy === 'post_tag') {
			return;
		}
		if (!taxonomies[taxonomy]) {
			taxonomies[taxonomy] = [];
		}
		taxonomies[taxonomy].push({
			termId: parseInt(term.optionalChildValue('term_id')),
			slug: term.optionalChildValue('term_slug'),
			name: term.optionalChildValue('term_name'),
			parent: term.optionalChildValue('term_parent') || null,
			description: term.optionalChildValue('term_description') || null
		});
	});

	return taxonomies;
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
