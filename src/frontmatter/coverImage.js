// get cover image filename, previously decoded and set on post.meta
// this one is unique as it relies on special logic executed by the parser
module.exports = (post) => {
	return post.meta.coverImage;
};
