const turndown = require('turndown');
const turndownPluginGfm = require('turndown-plugin-gfm');

function initTurndownService() {
	const turndownService = new turndown({
		headingStyle: 'atx',
		bulletListMarker: '-',
		codeBlockStyle: 'fenced'
	});

	turndownService.use(turndownPluginGfm.tables);

	// preserve embedded tweets
	turndownService.addRule('tweet', {
		filter: node => node.nodeName === 'BLOCKQUOTE' && node.getAttribute('class') === 'twitter-tweet',
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded codepens
	turndownService.addRule('codepen', {
		filter: node => {
			// codepen embed snippets have changed over the years
			// but this series of checks should find the commonalities
			return (
				['P', 'DIV'].includes(node.nodeName) &&
				node.attributes['data-slug-hash'] &&
				node.getAttribute('class') === 'codepen'
			);
		},
		replacement: (content, node) => '\n\n' + node.outerHTML
	});

	// preserve embedded scripts (for tweets, codepens, gists, etc.)
	turndownService.addRule('script', {
		filter: 'script',
		replacement: (content, node) => {
			let before = '\n\n';
			if (node.previousSibling && node.previousSibling.nodeName !== '#text') {
				// keep twitter and codepen <script> tags snug with the element above them
				before = '\n';
			}
			const html = node.outerHTML.replace('async=""', 'async');
			return before + html + '\n\n';
		}
	});

	// iframe boolean attributes do not need to be set to empty string
	turndownService.addRule('iframe', {
		filter: 'iframe',
		replacement: (content, node) => {
			const html = node.outerHTML
				.replace('allowfullscreen=""', 'allowfullscreen')
				.replace('allowpaymentrequest=""', 'allowpaymentrequest');
			return '\n\n' + html + '\n\n';
		}
	});

	// preserve <figure> when it contains a <figcaption>
	turndownService.addRule('figure', {
		filter: 'figure',
		replacement: (content, node) => {
			if (node.querySelector('figcaption')) {
				// extra newlines are necessary for markdown and HTML to render correctly together
				const result = '\n\n<figure>\n\n' + content + '\n\n</figure>\n\n';
				return result.replace('\n\n\n\n', '\n\n'); // collapse quadruple newlines
			} else {
				// does not contain <figcaption>, do not preserve
				return content;
			}
		}
	});

	// preserve <figcaption>
	turndownService.addRule('figcaption', {
		filter: 'figcaption',
		replacement: (content, node) => {
			// extra newlines are necessary for markdown and HTML to render correctly together
			return '\n\n<figcaption>\n\n' + content + '\n\n</figcaption>\n\n';
		}
	});

	// convert <pre> into a code block with language when appropriate
	turndownService.addRule('pre', {
		filter: node => {
			// a <pre> with <code> inside will already render nicely, so don't interfere
			return node.nodeName === 'PRE' && !node.querySelector('code');
		},
		replacement: (content, node) => {
			const language = node.getAttribute('data-wetm-language') || '';
			return '\n\n```' + language + '\n' + node.textContent + '\n```\n\n';
		}
	});

	return turndownService;
}

function getPostContent(postData, turndownService, config) {
	let content = postData.encoded[0];

	// insert an empty div element between double line breaks
	// this nifty trick causes turndown to keep adjacent paragraphs separated
	// without mucking up content inside of other elements (like <code> blocks)
	content = content.replace(/(\r?\n){2}/g, '\n<div></div>\n');

	if (config.saveScrapedImages) {
		// writeImageFile() will save all content images to a relative /images
		// folder so update references in post content to match
		content = content.replace(/(<img[^>]*src=").*?([^/"]+\.(?:gif|jpe?g|png|webp))("[^>]*>)/gi, '$1images/$2$3');
	}

	// preserve "more" separator, max one per post, optionally with custom label
	// by escaping angle brackets (will be unescaped during turndown conversion)
	content = content.replace(/<(!--more( .*)?--)>/, '&lt;$1&gt;');

	// some WordPress plugins specify a code language in an HTML comment above a
	// <pre> block, save it to a data attribute so the "pre" rule can use it
	content = content.replace(/(<!-- wp:.+? \{"language":"(.+?)"\} -->\r?\n<pre )/g, '$1data-wetm-language="$2" ');

	// use turndown to convert HTML to Markdown
	content = turndownService.turndown(content);

	// clean up extra spaces in list items
	content = content.replace(/(-|\d+\.) +/g, '$1 ');

	return content;
}

exports.initTurndownService = initTurndownService;
exports.getPostContent = getPostContent;
