// get excerpt, not decoded, newlines collapsed
module.exports = (post) => {
  const excerpt = post.data.encoded[1].replace(/[\r\n]+/gm, ' ');
  return excerpt;
};
