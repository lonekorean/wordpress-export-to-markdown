/*
	1. Copy this file, rename to the frontmatter field name you want, camelcased
	2. Edit frontmatter_fields in settings.js to include your new field name
	3. Run the script to see post data dumps, to see what you can work with
	4. Write your code to get and return what you want
	5. Update "get whatever" comment to describe what you're getting
	6. Remove your field name from frontmatter_fields in settings.js
	7. Remove this comment block and the debug console code
	8. Make that pull request!
*/

// get whatever
module.exports = (post) => {
	console.log('\nBEGIN POST DATA DUMP ===========================================================\n');
	console.dir(post, { depth: null });
	console.log('\nEND POST DATA DUMP =============================================================\n');

	return 'EXAMPLE: ' + post.data.title[0];
};
