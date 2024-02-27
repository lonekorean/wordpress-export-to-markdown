const luxon = require('luxon');

const settings = require('../settings');

// get post date, optionally formatted as specified in settings
module.exports = (post) => {
	const dateTime = luxon.DateTime.fromRFC2822(post.pubDate[0], { zone: settings.custom_date_timezone || 'utc' });

	if (settings.custom_date_formatting) {
		return dateTime.toFormat(settings.custom_date_formatting);
	} else if (settings.include_time_with_date) {
		return dateTime.toISO();
	} else {
		return dateTime.toISODate();
	}
};
