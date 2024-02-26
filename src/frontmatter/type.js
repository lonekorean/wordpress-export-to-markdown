// get type, often this will always be "post"
// but can also be "page" or other custom types
module.exports = (post) => {
	return post.data.post_type[0];
}
