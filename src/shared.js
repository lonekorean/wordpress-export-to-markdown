import path from 'path';

// simple data store, populated via intake, used everywhere
export const config = {};

export function camelCase(str) {
	return str.replace(/-(.)/g, (match) => match[1].toUpperCase());
}

export function getValue(obj, propName, index) {
	if (obj === undefined) {
		throw new Error(`Could not find undefined.${propName}.`)
	}

	let expression = `${obj['wetm-expression'] ?? 'object'}.${propName}`;
	
	const values = obj[propName];
	if (values === undefined) {
		throw new Error(`Could not find ${expression}.`)
	}

	if (index === undefined) {
		values.forEach((value, index) => {
			value['wetm-expression'] = `${expression}[${index}]`;
			// console.log('>>>', value['wetm-expression']);
		});
		return values;
	} else {
		expression += `[${index}]`;

		const value = values[index];
		if (value === undefined) {
			throw new Error(`Could not find ${expression}.`)
		}

		if (typeof value === 'object') {
			value['wetm-expression'] = expression;
			// console.log('>>>', value['wetm-expression']);
		}
		return value;
	}
}

export function getOptionalValue(obj, propName, index) {
	try {
		return getValue(obj, propName, index);
	} catch (ex) {
		return undefined;
	}
}

export function getSlugWithFallback(post) {
	return post.slug ? post.slug : 'id-' + post.id;
}

export function buildPostPath(post, overrideConfig) {
	const pathConfig = overrideConfig ?? config;

	// start with output folder
	const pathSegments = [pathConfig.output];

	// add folder for post type if exists
	if (post.type) {
		pathSegments.push(post.type);
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
	try {
		filename = decodeURIComponent(filename)
	} catch (ex) {
		// filename could not be decoded because of improper encoding with %
		// leave filename as-is and continue
	}
	return filename;
}
