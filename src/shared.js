function getFilenameFromUrl(url) {
	return decodeURIComponent(url.split('/').slice(-1)[0]);
}

exports.getFilenameFromUrl = getFilenameFromUrl;
