export function author(post) {
	// not decoded, WordPress doesn't allow funky characters in usernames anyway
	return post.data.getSingle('creator', 0).value;
}

export function categories(post) {
	// array of decoded category names, excluding 'uncategorized'
	const categories = post.data.getAll('category', false) ?? [];
	return categories
		.filter((category) => category.getAttribute('domain') === 'category' && category.getAttribute('nicename') !== 'uncategorized')
		.map((category) => decodeURIComponent(category.getAttribute('nicename')));
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
	return post.data.getSingle('encoded', 1).value.replace(/[\r\n]+/gm, ' ');
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
	const categories = post.data.getAll('category', false) ?? [];
	return categories
		.filter((category) => category.getAttribute('domain') === 'post_tag')
		.map((category) => decodeURIComponent(category.getAttribute('nicename')));
}

export function title(post) {
	// not decoded
	return post.data.getSingle('title', 0).value;
}

export function type(post) {
	// previously parsed but not decoded, can be "post", "page", or other custom types
	return post.type;
}
