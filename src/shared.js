function getFilenameFromUrl(url) {
	let filename = url.split('/').slice(-1)[0];
	try {
		filename = decodeURIComponent(filename)
	} catch (ex) {
		// filename could not be decoded because of improper encoding with %
		// leave filename as-is and continue
	}
	return filename;
}

exports.getFilenameFromUrl = getFilenameFromUrl;
