function getFilenameFromUrl(url) {
	return url.split('/').slice(-1)[0];
}

exports.getFilenameFromUrl = getFilenameFromUrl;
