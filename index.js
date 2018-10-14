const fs = require('fs');
const luxon = require('luxon');
const path = require('path');
const minimist = require('minimist');
const xml2js = require('xml2js');

// command line argument defaults
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
	xml2js.parseString(fileContent, processors, (err, result) => {
		if (err) {
			console.log('Unable to parse file content.');
			console.log(err);        
		} else {
			processPosts(result);
		}
	});
}

function processPosts(result) {
	let posts = result.rss.channel[0].item
		.filter(item => item.post_type.includes('post'))
		.map(post => ({
			frontmatter: {
				slug: translateSlug(post.link[0]),
				title: translateTitle(post.title[0]),
				date: translateDate(post.pubDate[0])
			},
			content: translateContent(post.encoded[0])
		}));

		writeMarkdownFiles(posts);
}

function translateSlug(value) {
	let url = new URL(value);
	let trimmedPath = url.pathname.replace(/\/$/, '');
	let pathPieces = trimmedPath.split('/');
	return pathPieces.pop();
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

function writeMarkdownFiles(posts) {
	posts.forEach(post => {
		const dir = path.join(outputDir, post.frontmatter.slug);
		try {
			fs.accessSync(dir, fs.constants.F_OK);
		} catch (ex) {
			fs.mkdirSync(dir, { recursive: true });
		}

		const content = createMarkdownContent(post);
		fs.writeFileSync(path.join(dir, 'index.md'), content);
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
