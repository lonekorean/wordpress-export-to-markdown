// get excerpt, not decoded, newlines collapsed
module.exports = (post) => {
  const excerpt = post.data.encoded[1].replace(/[(\r\n|\n|\r)]/gm, " ");
  return excerpt;
};
