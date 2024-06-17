const luxon = require('luxon');

const settings = require('../settings');

// get post date, optionally formatted as specified in settings
// this value is also used for year/month folders, date prefixes, etc. as needed
module.exports = (post) => {
	return luxon.DateTime.fromRFC2822(post.data.pubDate[0], {
		zone: settings.custom_date_timezone,
	});
};
