const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const minimist = require('minimist');
const request = require('request');
const xml2js = require('xml2js');

// defaults
let inputFile = 'export.xml';
let outputDir = 'output';

function init() {
	const argv = minimist(process.argv.slice(2));
	if (typeof argv.inputfile === 'string') {
		inputFile = argv.inputfile;
	}
	if (typeof argv.outputdir === 'string') {
		outputDir = argv.outputdir;
	}

	let fileContent = readFile(inputFile);
	parseFileContent(fileContent);
}

function readFile(filename) {
	try {
		return fs.readFileSync(filename, 'utf8');
	} catch (ex) {
		console.log('Unable to read file.');
		console.log(ex.message);
	}
}

function parseFileContent(fileContent) {
	const processors = { tagNameProcessors: [ xml2js.processors.stripPrefix ] };
	xml2js.parseString(fileContent, processors, (err, data) => {
		if (err) {
			console.log('Unable to parse file content.');
			console.log(err);        
		} else {
			processData(data);
		}
	});
}

function processData(data) {
	let images = collectImages(data);
	let posts = collectPosts(data);
	mergeImagesIntoPosts(images, posts);

	writeMarkdownFiles(posts);
}

function collectImages(data) {
	return getItemsOfType(data, 'attachment')
		.filter(image => (/\.(gif|jpg|png)$/i).test(image.attachment_url[0]))
		.map(attachment => ({
			id: attachment.post_id[0],
			postId: attachment.post_parent[0],
			url: attachment.attachment_url[0]
		}));	
}

function collectPosts(data, images) {
	return getItemsOfType(data, 'post')
		.map(post => ({
			meta: {
				id: post.post_id[0],
				coverImageId: getCoverImageId(post)
			},
			frontmatter: {
				slug: translateSlug(post.post_name[0]),
				title: translateTitle(post.title[0]),
				date: translateDate(post.pubDate[0])
			},
			content: translateContent(post.encoded[0])
		}));
}

function mergeImagesIntoPosts(images, posts) {
	let postsLookup = posts.reduce((lookup, post) => {
		lookup[post.meta.id] = post;
		return lookup;
	}, {});

	images.forEach(image => {
		let post = postsLookup[image.postId];
		if (post) {
			post.meta.imageUrls = post.meta.imageUrls || [];
			post.meta.imageUrls.push(image.url);

			if (image.id === post.meta.coverImageId) {
				post.meta.coverImageUrl = image.url;
				post.frontmatter.coverImageFilename = getFilenameFromPath(image.url);
			}
		}
	});
}

function getItemsOfType(data, type) {
	return data.rss.channel[0].item.filter(item => item.post_type[0] === type);
}

function getCoverImageId(post) {
	let postMeta = post.postmeta.find(postmeta => postmeta.meta_key[0] === '_thumbnail_id');
	let result = postMeta ? postMeta.meta_value[0] : undefined;
	return result;
}

function translateSlug(value) {
	return value;
}

function translateTitle(value) {
	return value;
}

function translateDate(value) {
	return luxon.DateTime.fromRFC2822(value, { zone: 'utc' }).toISO();
}

function translateContent(value) {
	return value.trim();
}

function getFilenameFromPath(path) {
	return path.split('/').slice(-1)[0];
}

function writeMarkdownFiles(posts) {
	posts.forEach(post => {
		const dir = path.join(outputDir, post.frontmatter.slug);
		try {
			fs.accessSync(dir, fs.constants.F_OK);
		} catch (ex) {
			fs.mkdirSync(dir, { recursive: true });
		}

		const content = createMarkdownContent(post);
		const postPath = path.join(dir, 'index.md');
		fs.writeFile(postPath, content, (err) => {
			if (err) {
				console.log('Unable to write file.')
				console.log(err);
			} else {
				console.log('Wrote ' + postPath + '.');
			}
		});

		if (post.meta.imageUrls) {
			post.meta.imageUrls.forEach(imageUrl => {
				let imagePath = path.join(dir, getFilenameFromPath(imageUrl));
				let stream = fs.createWriteStream(imagePath);
				stream.on('finish', () => {
					console.log('Saved ' + imagePath + '.');
				});

				request
					.get(imageUrl)
					.on('response', response => {
						if (response.statusCode !== 200) {
							console.log('Response status code ' + response.statusCode + ' received for ' + imageUrl + '.');
						}
					})
					.on('error', err => {
						console.log('Unable to download image.');
						console.log(err);
					})
					.pipe(stream);
			});
		}
	});
}

function createMarkdownContent(post) {
	const frontmatter = Object.entries(post.frontmatter)
		.reduce((accumulator, pair) => {
			return accumulator + pair[0] + ': "' + pair[1] + '"\n'
		}, '');
	
	return '---\n' + frontmatter + '---\n\n' + post.content + '\n';
}

init();
