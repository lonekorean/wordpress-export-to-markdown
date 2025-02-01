import * as luxon from 'luxon';
import * as settings from './settings.js';

// get author, without decoding
// WordPress doesn't allow funky characters in usernames anyway
export function getAuthor(post) {
	return post.data.creator[0];
}

// get array of decoded category names, filtered as specified in settings
export function getCategories(post) {
	if (!post.data.category) {
		return [];
	}

	const categories = post.data.category
		.filter(category => category.$.domain === 'category')
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));

	return categories.filter(category => !settings.filter_categories.includes(category));
}

// get cover image filename, previously decoded and set on post.meta
// this one is unique as it relies on special logic executed by the parser
export function getCoverImage(post) {
	return post.meta.coverImage;
}

// get post date, optionally formatted as specified in settings
// this value is also used for year/month folders, date prefixes, etc. as needed
export function getDate(post) {
	const dateTime = luxon.DateTime.fromRFC2822(post.data.pubDate[0], { zone: settings.custom_date_timezone });

	if (settings.custom_date_formatting) {
		return dateTime.toFormat(settings.custom_date_formatting);
	} else if (settings.include_time_with_date) {
		return dateTime.toISO();
	} else {
		return dateTime.toISODate();
	}
}

// get excerpt, not decoded, newlines collapsed
export function getExcerpt(post) {
	return post.data.encoded[1].replace(/[\r\n]+/gm, ' ');
}

// get ID
export function getId(post) {
	return post.data.post_id[0];
}

// get slug, previously decoded and set on post.meta
export function getSlug(post) {
	return post.meta.slug;
}

// get array of decoded tag names
export function getTags(post) {
	if (!post.data.category) {
		return [];
	}

	const categories = post.data.category
		.filter(category => category.$.domain === 'post_tag')
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));

	return categories;
}

// get simple post title, but not decoded like other frontmatter string fields
export function getTitle(post) {
	return post.data.title[0];
}

// get type, often this will always be "post"
// but can also be "page" or other custom types
export function getType(post) {
	return post.data.post_type[0];
}
