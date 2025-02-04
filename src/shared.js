import path from 'path';

export function buildPostPath(outputDir, type, date, slug, config) {
	// start with base output dir and post type
	const pathSegments = [outputDir, type];

	if (config.dateFolders === 'year' || config.dateFolders === 'year-month') {
		pathSegments.push(date.toFormat('yyyy'));
	}

	if (config.dateFolders === 'year-month') {
		pathSegments.push(date.toFormat('LL'));
	}

	// create slug fragment, possibly date prefixed
	let slugFragment = slug;
	if (config.prefixDate) {
		slugFragment = date.toFormat('yyyy-LL-dd') + '-' + slugFragment;
	}

	// use slug fragment as folder or filename as specified
	if (config.postFolders) {
		pathSegments.push(slugFragment, 'index.md');
	} else {
		pathSegments.push(slugFragment + '.md');
	}

	return path.join(...pathSegments);
}

export function getFilenameFromUrl(url) {
	let filename = url.split('/').slice(-1)[0];
	try {
		filename = decodeURIComponent(filename)
	} catch (ex) {
		// filename could not be decoded because of improper encoding with %
		// leave filename as-is and continue
	}
	return filename;
}
