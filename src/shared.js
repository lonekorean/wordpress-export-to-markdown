import chalk from 'chalk';
import path from 'path';

// simple data store, populated via intake, used everywhere
export const config = {};

export function camelCase(str) {
	return str.replace(/-(.)/g, (match) => match[1].toUpperCase());
}

export function getSlugWithFallback(post) {
	return post.slug ? post.slug : 'id-' + post.id;
}

export function logHeading(text) {
	console.log(`\n${chalk.cyan(text + '...')}`);
}

export function buildPostPath(post, overrideConfig) {
	const pathConfig = overrideConfig ?? config;

	// start with output folder
	const pathSegments = [pathConfig.output];

	// add folder for post type if exists
	if (post.type) {
		switch (post.type) {
			case 'post':
				pathSegments.push('posts');
				break;
			case 'page':
				pathSegments.push('pages');
				break;
			default:
				pathSegments.push('custom');
				pathSegments.push(post.type);	
		}
	}

	// add drafts folder if this is a draft post
	if (post.isDraft) {
		pathSegments.push('_drafts');
	}

	// add folders for date year/month as appropriate
	if (post.date) {
		if (pathConfig.dateFolders === 'year' || pathConfig.dateFolders === 'year-month') {
			pathSegments.push(post.date.toFormat('yyyy'));
		}

		if (pathConfig.dateFolders === 'year-month') {
			pathSegments.push(post.date.toFormat('LL'));
		}
	}

	// get slug with fallback
	let slug = getSlugWithFallback(post);

	// prepend date to slug as appropriate
	if (pathConfig.prefixDate && post.date) {
		slug = post.date.toFormat('yyyy-LL-dd') + '-' + slug;
	}

	// Append language suffix to prevent WPML collisions
	if ((pathConfig.appendLanguageToSlug ?? true) && post.lang) {
		slug = slug + '-' + post.lang;
	}

	// use slug as folder or filename as specified
	if (pathConfig.postFolders) {
		pathSegments.push(slug, 'index.md');
	} else {
		pathSegments.push(slug + '.md');
	}

	return path.join(...pathSegments);
}

export function getFilenameFromUrl(url) {
	let filename = url.split('/').slice(-1)[0];
	
	// Remove query parameters and hash fragments from filename
	filename = filename.split('?')[0].split('#')[0];
	
	// Replace any other invalid Windows filename characters
	const invalidChars = /[<>:"\/\\|?*]/g;
	filename = filename.replace(invalidChars, '_');
	
	try {
		filename = decodeURIComponent(filename)
	} catch (ex) {
		// filename could not be decoded because of improper encoding with %
		// leave filename as-is and continue
	}
	return filename;
}
