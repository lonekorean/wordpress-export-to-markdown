const settings = require('../settings');

module.exports = (post) => {
	if (!post.data.category) {
		return [];
	}

	const categories = post.data.category
		.filter(category => category.$.domain === 'post_tag')
		.map(({ $: attributes }) => decodeURIComponent(attributes.nicename));

  return categories;
};
