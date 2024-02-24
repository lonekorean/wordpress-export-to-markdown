// get cover image filename, previously set on post.meta
// this one is unique as it relies on logic executed by the parser
module.exports = (post) => {
	return post.meta.coverImage;
};
