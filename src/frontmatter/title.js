// get simple post title, but not decoded like other frontmatter string fields
module.exports = (post) => {
	return post.data.title[0];
};
