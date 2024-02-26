// get excerpt, not decoded, newlines collapsed
module.exports = (post) => {
	return post.data.encoded[1].replace(/[\r\n]+/gm, ' ');
};
