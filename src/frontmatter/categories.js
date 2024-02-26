const settings = require('../settings');

// get array of decoded category names, filtered as specified in settings
module.exports = (post) => {
	if (!post.data.category) {
		return [];
	}

	const categories = post.data.category
		.filter(category => category.$.domain === 'category')
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));

	return categories.filter(category => !settings.filter_categories.includes(category));
};
