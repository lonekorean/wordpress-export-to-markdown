// get slug, previously decoded and set on post.meta
module.exports = (post) => {
	return post.meta.slug;
};
