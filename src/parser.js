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

  // 1) Load and parse the XML
  const content = await fs.promises.readFile(shared.config.input, 'utf8');
  const rssData = await data.load(content);
  const allPostData = rssData.child('channel').children('item');

  // 2) Determine which post types to include/exclude
  let postTypes = getPostTypes(allPostData);
  if (shared.config.postTypes?.length) {
    postTypes = postTypes.filter(pt => shared.config.postTypes.includes(pt));
  }
  if (shared.config.excludePostTypes?.length) {
    postTypes = postTypes.filter(pt => !shared.config.excludePostTypes.includes(pt));
  }

  // 3) Collect the basic posts
  let posts = collectPosts(allPostData, postTypes);

  // 3) category‐based filtering
  if (shared.config.includeCategories.length) {
    posts = posts.filter(post =>
      frontmatter.categories(post)?.some(cat =>
        shared.config.includeCategories.includes(cat)
      )
    );
  }
  if (shared.config.excludeCategories.length) {
    posts = posts.filter(post =>
      !frontmatter.categories(post)?.some(cat =>
         shared.config.excludeCategories.includes(cat)
      )
    );
  }

  // 4) Collect images exactly as before
  const images = [];
  if (shared.config.saveImages === 'attached' || shared.config.saveImages === 'all') {
    images.push(...collectAttachedImages(allPostData));
  }
  if (shared.config.saveImages === 'scraped' || shared.config.saveImages === 'all') {
    images.push(...collectScrapedImages(allPostData, postTypes));
  }
  mergeImagesIntoPosts(images, posts);

  // 5) Build a lookup by post ID so we can enrich posts in place
  const postById = Object.fromEntries(posts.map(p => [String(p.id), p]));

    // 6) Parse all <term> entries (namespace stripped) for post_translations groups
  const termMappings = {};
  const termNodes = rssData.child('channel').children('term') || [];
  for (const term of termNodes) {
    const taxonomy = term.childValue('term_taxonomy');
    if (taxonomy !== 'post_translations') continue;

    const slug    = term.childValue('term_slug');
    const rawDesc = term.childValue('term_description') || '';

    try {
      const parsed = unserialize(rawDesc);
      // Normalize IDs to strings
      termMappings[slug] = Object.fromEntries(
        Object.entries(parsed).map(([lang, id]) => [lang, String(id)])
      );
    } catch (err) {
      console.warn(`⚠️ Could not parse term_description for ${slug}`, err);
    }
  }

  // 7) Walk each <item> again to pull out Polylang categories
  for (const item of allPostData) { // use just 'posts', pre-filtered?
    const id = item.childValue('post_id');
    const post = postById[id];
    if (!post) continue;

    // Initialize polylang container
    post.polylang = {
      language: null,
      groupSlug: null,
      translationMap: null
    };

    // Read all <category> tags on this item (xml2js puts them in item.category[])
    const cats = item.children('category') || [];
    for (const cat of cats) {
      // xml2js stores attributes under `.$`
      const domain   = cat.attribute('domain');
      const nicename = cat.attribute('nicename');
      if (domain === 'language') {
        post.polylang.language = nicename;
      }
      if (domain === 'post_translations') {
        post.polylang.groupSlug = nicename;
      }
    }

    // Attach the full translationMap if we have one
    const gs = post.polylang.groupSlug;
    if (gs && termMappings[gs]) {
      post.polylang.translationMap = termMappings[gs];
    }
  }

  // 8) Finally, build frontmatter (and any other per-post enrichment)
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

/**
 * allPosts: an array of post objects, each with:
 *   - post.id            (string or number)
 *   - post.slug          (string)
 *   - post.language      (string or null)
 *   - post._pllTranslations (object or null)
 *
 * Returns: an object whose keys are groupKey (string),
 * and whose values are arrays of post objects in that group.
 */
 export function buildTranslationGroups(allPosts) {
   const groups = {};

   for (const post of allPosts) {
     let key;

     const tm = post.polylang.translationMap;
     if (tm && Object.keys(tm).length > 0) {
       // tm values are post IDs as strings
       const ids = Object.values(tm).slice().sort();
       key = ids.join(',');
     } else {
       key = String(post.id);
     }

     if (!groups[key]) groups[key] = [];
     groups[key].push(post);
   }

   return groups;
 }

export function chooseBaseSlug(postsInGroup, defaultLangCode) {
  // postsInGroup is an array of post objects, each with post.slug and post.language.
  // 1. Try to find the post whose post.language === defaultLangCode:
  let candidate = postsInGroup.find(p => p.language === defaultLangCode);
  if (candidate) {
    return candidate.slug;
  }
  // 2. If none matched (rare if the group didn’t contain the default), pick the first post’s slug:
  return postsInGroup[0].slug;
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
		link: data.childValue('link'),
		isPublished: data.childValue('status') === 'publish',
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

/**
 * Deep-sets `obj[path[0]][path[1]]… = value`, creating intermediate
 * objects if they don’t yet exist.
 *
 * @param {object} obj    The object to modify
 * @param {string[]} path Array of keys, e.g. ['seo','title']
 * @param {*} value       The value to assign
 */
function setNested(obj, path, value) {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (cur[key] == null || typeof cur[key] !== 'object') {
      cur[key] = {};
    }
    cur = cur[key];
  }
  // final segment
  cur[path[path.length - 1]] = value;
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
      // split “metaKey:alias.path” or just “metaKey”
      const [metaKey, rawAlias] = field.split(':').map(s => s.trim());
      const alias = rawAlias || metaKey;

      const value = getPostMetaValue(post.data, metaKey);
      if (value !== undefined && value !== null && value !== '') {
        // build the path segments for nested assignment:
        const pathSegments = alias.split('.');
        // deep‐assign into post.frontmatter
        setNested(post.frontmatter, pathSegments, value);
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
