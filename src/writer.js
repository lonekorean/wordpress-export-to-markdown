import axios from 'axios';
import chalk from 'chalk';
import fs from 'fs';
import http from 'http';
import https from 'https';
import * as luxon from 'luxon';
import path from 'path';
import * as shared from './shared.js';

import { buildTranslationGroups, chooseBaseSlug } from './parser.js';

export async function writeFilesPromise(posts) {

  let groupMap = {};

  // Polylang translation sets need a different approach
  if (shared.config.polylang) {
    // Build the “groupMap” only if Polylang mode is on, otherwise treat each post as its own group
    console.log('Building Polylang translation groups...')
    groupMap = buildTranslationGroups(posts)
  } else {
    // If not using Polylang, place each post in its own group so we can reuse the same loop later
    for (const post of posts) {
      groupMap[String(post.id)] = [post];
    }
  }

  console.log(Object.keys(groupMap).filter(key => key.length > 5))

	await writeMarkdownFilesPromise(groupMap);
	await writeImageFilesPromise(groupMap);
}

async function processPayloadsPromise(payloads, loadFunc) {
	const promises = payloads.map((payload) => new Promise((resolve, reject) => {
		setTimeout(async () => {
			try {
				const data = await loadFunc(payload.item);
				await writeFile(payload.destinationPath, data);
				logPayloadResult(payload);
				resolve();
			} catch (ex) {
				logPayloadResult(payload, ex.message);
				reject();
			}
		}, payload.delay);
	}));

	const results = await Promise.allSettled(promises);
	const failedCount = results.filter((result) => result.status === 'rejected').length;
	if (failedCount === 0) {
		console.log('Done, got them all!');
	} else {
		console.log('Done, but with ' + chalk.red(failedCount + ' failed') + '.');
	}
}

async function writeFile(destinationPath, data) {
	await fs.promises.mkdir(path.dirname(destinationPath), { recursive: true });
	await fs.promises.writeFile(destinationPath, data);
}

/**
 * @param {Object.<string,import('./parser.js').Post[]>} groupMap
 *    A map of groupKey → array of posts in that translation group
 */
async function writeMarkdownFilesPromise_v1(groupMap) {
  let existingCount = 0;
  let delay = 0;
  const payloads = Object.entries(groupMap).flatMap(([groupKey, postsInGroup]) => {
    // —— Polylang mode: multiple translations per group ——
    if (shared.config.polylang && postsInGroup.length > 1) {
      const baseSlug = chooseBaseSlug(postsInGroup, shared.config.defaultLanguage);

      // Prepare per‐group folder if needed
      const groupFolder = shared.config.postFolders
        ? path.join(shared.config.output, baseSlug)
        : shared.config.output;
      if (shared.config.postFolders) {
        fs.mkdirSync(groupFolder, { recursive: true });
      }

      return postsInGroup.flatMap((post) => {
        // e.g. "my-post.en.md"
        const lang = post.polylang.language || 'und';
        const fileName = shared.config.postFolders
          ? `index.${lang}.md`
          : `${baseSlug}.${lang}.md`;
        const destinationPath = shared.config.postFolders
          ? path.join(groupFolder, fileName)
          : path.join(shared.config.output, fileName);

        if (fs.existsSync(destinationPath)) {
          existingCount++;
          return [];
        }

        const payload = {
          item: post,
          type: post.type,
          name: fileName,
          destinationPath,
          delay
        };
        delay += shared.config.writeDelay;
        return [payload];
      });
    }

    // —— Fallback: single‐post groups (or polylang=false) ——
    return postsInGroup.flatMap((post) => {
      const destinationPath = shared.buildPostPath(post);
      if (fs.existsSync(destinationPath)) {
        existingCount++;
        return [];
      }
      const payload = {
        item: post,
        type: post.type,
        name: shared.getSlugWithFallback(post),
        destinationPath,
        delay
      };
      delay += shared.config.writeDelay;
      return [payload];
    });
  });

  logSavingMessage('posts', existingCount, payloads.length);
  if (payloads.length > 0) {
    await processPayloadsPromise(payloads, loadMarkdownFilePromise);
  }
}

/**
 * @param {Object.<string, Array>} groupMap
 *   A map where each key is a translation-group identifier (or a single-post ID)
 *   and each value is an array of post objects in that group.
 */
async function writeMarkdownFilesPromise(groupMap) {
  let existingCount = 0;
  let delay = 0;
  const payloads = [];

  for (const [groupKey, postsInGroup] of Object.entries(groupMap)) {
    // —— Polylang: multiple translations in one group ——
    if (shared.config.polylang && postsInGroup.length > 1) {
      // 1) Pick the canonical base slug for the group:
      const baseSlug = chooseBaseSlug(postsInGroup, shared.config.defaultLanguage);

      // 2) “Fake” a base post so buildPostPath() gives us the right folder path:
      const fakeBasePost = { ...postsInGroup[0], slug: baseSlug };
      const basePath = shared.buildPostPath(fakeBasePost);
      const groupFolder = shared.config.postFolders
        ? path.dirname(basePath)
        : null;

      // 3) For each translation, compute its destinationPath:
      for (const post of postsInGroup) {
        const lang = post.polylang.language || 'und';
        let destinationPath;

        if (shared.config.postFolders) {
          // inside the group folder, name it "index.<lang>.md"
          destinationPath = path.join(groupFolder, `index.${lang}.md`);
        } else {
          // no per-post folders: fake a slug with the language appended
          const fakeLangPost = { ...post, slug: `${baseSlug}.${lang}` };
          destinationPath = shared.buildPostPath(fakeLangPost);
        }

        if (fs.existsSync(destinationPath)) {
          existingCount++;
        } else {
          payloads.push({
            item: post,
            type: post.type,
            destinationPath,
            delay
          });
          delay += shared.config.writeDelay;
        }
      }

    } else {
      // —— Single-post (no translations) or Polylang disabled ——
      for (const post of postsInGroup) {
        const destinationPath = shared.buildPostPath(post);
        if (fs.existsSync(destinationPath)) {
          existingCount++;
        } else {
          payloads.push({
            item: post,
            type: post.type,
            destinationPath,
            delay
          });
          delay += shared.config.writeDelay;
        }
      }
    }
  }

  // 4) Kick off the actual file writes
  logSavingMessage('posts', existingCount, payloads.length);
  if (payloads.length > 0) {
    await processPayloadsPromise(payloads, loadMarkdownFilePromise);
  }
}

async function loadMarkdownFilePromise(post) {
	let output = '---\n';

	Object.entries(post.frontmatter).forEach(([key, value]) => {
		let outputValue;
		if (Array.isArray(value)) {
			if (value.length > 0) {
				// array of one or more strings
				outputValue = value.reduce((list, item) => `${list}\n  - "${item}"`, '');
			}
		} else if (Number.isInteger(value)) {
			// output unquoted
			outputValue = value.toString();
		} else if (value instanceof luxon.DateTime) {
			if (shared.config.dateFormat) {
				outputValue = value.toFormat(shared.config.dateFormat);
			} else {
				outputValue = shared.config.includeTime ? value.toISO() : value.toISODate();
			}

			if (shared.config.quoteDate) {
				outputValue = `"${outputValue}"`;
			}
		} else if (typeof value === 'boolean') {
			// output unquoted
			outputValue = value.toString();
		} else if (value !== null && typeof value === 'object') {
			// Nested objects → YAML mappings
			outputValue = ""
			for (const [subKey, subVal] of Object.entries(value)) {
			  outputValue += `\n  ${subKey}: ${subVal}`
			}
		} else if (typeof value === 'string' && value.includes('\n')) {
			// Multi-line strings → literal block
			// outputValue = `${key}: |\n`
			value.split('\n').forEach(line => {
				outputValue += `  ${line}\n`
			})
		} else {
			// single string value
			const escapedValue = (value ?? '').replace(/"/g, '\\"');
			if (escapedValue.length > 0) {
				outputValue = `"${escapedValue}"`;
			}
		}

		if (outputValue !== undefined) {
			output += `${key}: ${outputValue}\n`;
		}
	});

	output += `---\n\n${post.content}\n`;

	// for each post.metaContent object attribute, append to output
	Object.entries(post.metaContent).forEach(([key, value]) => {
		output += `\n\n::${key}\n${value}\n::\n`;
	});

	return output;
}

/**
 * @param {Object.<string, import('./parser.js').Post[]>} groupMap
 *   A map of groupKey → array of posts in that translation group
 */
async function writeImageFilesPromise(groupMap) {
  let existingCount = 0;
  let delay = 0;
  const payloads = [];

  for (const [groupKey, postsInGroup] of Object.entries(groupMap)) {
    // Determine the images directory for this group
    let imagesDir;

    if (shared.config.polylang && postsInGroup.length > 1) {
      // Polylang group: use the group’s base slug folder
      const baseSlug = chooseBaseSlug(postsInGroup, shared.config.defaultLanguage);
      const groupFolder = shared.config.postFolders
        ? path.join(shared.config.output, baseSlug)
        : shared.config.output;
      imagesDir = path.join(groupFolder, 'images');
    } else {
      // Single-post or non-Polylang: images next to that post’s path
      for (const post of postsInGroup) {
        const postPath = shared.buildPostPath(post);
        const dir = path.join(path.dirname(postPath), 'images');
        // collect images for this one post
        for (const imageUrl of post.imageUrls) {
          const filename = shared.getFilenameFromUrl(imageUrl);
          const destinationPath = path.join(dir, filename);
          if (checkFile(destinationPath)) {
            existingCount++;
            continue;
          }
          payloads.push({
            item: imageUrl,
            type: 'image',
            name: filename,
            destinationPath,
            delay
          });
          delay += shared.config.requestDelay;
        }
      }
      // skip ahead to next group
      continue;
    }

    // For a Polylang group, gather images from _all_ translations into one folder
    for (const post of postsInGroup) {
      for (const imageUrl of post.imageUrls) {
        const filename = shared.getFilenameFromUrl(imageUrl);
        const destinationPath = path.join(imagesDir, filename);
        if (checkFile(destinationPath)) {
          existingCount++;
          continue;
        }
        payloads.push({
          item: imageUrl,
          type: 'image',
          name: filename,
          destinationPath,
          delay
        });
        delay += shared.config.requestDelay;
      }
    }
  }

  logSavingMessage('images', existingCount, payloads.length);
  if (payloads.length > 0) {
    await processPayloadsPromise(payloads, loadImageFilePromise);
  }
}

async function loadImageFilePromise(imageUrl) {
	// only encode the URL if it doesn't already have encoded characters
	const url = (/%[\da-f]{2}/i).test(imageUrl) ? imageUrl : encodeURI(imageUrl);

	const requestConfig = {
		method: 'get',
		url,
		headers: {
			'User-Agent': 'wordpress-export-to-markdown'
		},
		responseType: 'arraybuffer'
	};

	if (!shared.config.strictSsl) {
		// custom agents to disable SSL errors (adding both http and https, just in case)
		requestConfig.httpAgent = new http.Agent({ rejectUnauthorized: false });
		requestConfig.httpsAgent = new https.Agent({ rejectUnauthorized: false });
	}

	const response = await axios(requestConfig);
	const buffer = Buffer.from(response.data, 'binary');

	return buffer;
}

function checkFile(path) {
	return fs.existsSync(path);
}

function logSavingMessage(things, existingCount, remainingCount) {
	shared.logHeading(`Saving ${things}`);
	if (existingCount + remainingCount === 0) {
		console.log(`No ${things} to save.`);
	} else if (existingCount === 0) {
		console.log(`${remainingCount} ${things} to save.`);
	} else if (remainingCount === 0) {
		console.log(`All ${existingCount} ${things} already saved.`);
	} else {
		console.log(`${existingCount} ${things} already saved, ${remainingCount} remaining.`);
	}
}

function logPayloadResult(payload, errorMessage) {
	const messageBits = [
		errorMessage ? chalk.red('✗') : chalk.green('✓'),
		chalk.gray(`[${payload.type}]`),
		payload.name
	];
	if (errorMessage) {
		messageBits.push(chalk.red(`(${errorMessage})`));
	}

	console.log(messageBits.join(' '));
}
