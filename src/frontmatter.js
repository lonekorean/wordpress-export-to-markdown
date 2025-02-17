import * as shared from './shared.js';

export function author(post) {
	// not decoded, WordPress doesn't allow funky characters in usernames anyway
	return shared.getValue(post.data, 'creator', 0);
}

export function categories(post) {
	// array of decoded category names, excluding 'uncategorized'
	const categories = shared.getOptionalValue(post.data, 'category') ?? [];
	return categories
		.filter((category) => category.$.domain === 'category' && category.$.nicename !== 'uncategorized')
		.map((category) => decodeURIComponent(category.$.nicename));
}

export function coverImage(post) {
	// cover image filename, previously parsed and decoded
	return post.coverImage;
}

export function date(post) {
	// a luxon datetime object, previously parsed
	return post.date;
}

export function draft(post) {
	// boolean representing the previously parsed draft status, only included when true
	return post.isDraft ? true : undefined;
}

export function excerpt(post) {
	// not decoded, newlines collapsed
	return shared.getValue(post.data, 'encoded', 1).replace(/[\r\n]+/gm, ' ');
}

export function id(post) {
	// previously parsed as a string, converted to integer here
	return parseInt(post.id);
}

export function slug(post) {
	// previously parsed and decoded
	return post.slug;
}

export function tags(post) {
	// array of decoded tag names (yes, they come from <category> nodes, not a typo)
	const categories = shared.getOptionalValue(post.data, 'category') ?? [];
	return categories
		.filter((category) => category.$.domain === 'post_tag')
		.map((category) => decodeURIComponent(category.$.nicename));
}

export function title(post) {
	// not decoded
	return shared.getValue(post.data, 'title', 0);
}

export function type(post) {
	// previously parsed but not decoded, can be "post", "page", or other custom types
	return post.type;
}
