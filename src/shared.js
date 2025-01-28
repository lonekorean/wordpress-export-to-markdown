import * as luxon from 'luxon';
import path from 'path';
import * as settings from './settings.js';

export function buildPostPath(outputDir, type, date, slug, config) {
	let dt;
	if (settings.custom_date_formatting) {
		dt = luxon.DateTime.fromFormat(date, settings.custom_date_formatting);
	} else {
		dt = luxon.DateTime.fromISO(date);
	}

	// start with base output dir and post type
	const pathSegments = [outputDir, type];

	if (config.dateFolders === 'year' || config.dateFolders === 'year-month') {
		pathSegments.push(dt.toFormat('yyyy'));
	}

	if (config.dateFolders === 'year-month') {
		pathSegments.push(dt.toFormat('LL'));
	}

	// create slug fragment, possibly date prefixed
	let slugFragment = slug;
	if (config.prefixDate) {
		slugFragment = dt.toFormat('yyyy-LL-dd') + '-' + slugFragment;
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
