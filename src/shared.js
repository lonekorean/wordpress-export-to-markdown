import path from 'path';

// simple data store, populated via intake, used everywhere
export const config = {};

export function camelCase(str) {
	return str.replace(/-(.)/g, (match) => match[1].toUpperCase());
}

export function buildPostPath(type, date, slug, overrideConfig) {
	const pathConfig = overrideConfig ?? config;

	// start with base output dir and post type
	const pathSegments = [pathConfig.output, type];

	if (pathConfig.dateFolders === 'year' || pathConfig.dateFolders === 'year-month') {
		pathSegments.push(date.toFormat('yyyy'));
	}

	if (pathConfig.dateFolders === 'year-month') {
		pathSegments.push(date.toFormat('LL'));
	}

	// create slug fragment, possibly date prefixed
	let slugFragment = slug;
	if (pathConfig.prefixDate) {
		slugFragment = date.toFormat('yyyy-LL-dd') + '-' + slugFragment;
	}

	// use slug fragment as folder or filename as specified
	if (pathConfig.postFolders) {
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
