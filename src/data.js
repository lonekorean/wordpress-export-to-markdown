import xml2js from 'xml2js';

class Data {
	#obj;
	#expression;

	constructor(obj, expression) {
		this.#obj = typeof obj === 'string' ? { _: obj } : obj;
		this.#expression = expression;
	}

	get value() {
		const value = this.#obj._;
		if (value === undefined) {
			throw new Error(`Could not get value from ${this.#expression}.`);
		}

		return value;
	}

	#buildExpression(propName, index) {
		let expression = `${this.#expression}.${propName}`;
		if (index !== undefined) {
			expression += `[${index}]`;
		}

		return expression;
	}

	children(propName) {
		const nodes = this.#obj[propName] ?? [];
		return nodes.map((value, index) => new Data(value, this.#buildExpression(propName, index)));
	}

	child(propName, index = 0) {
		const nodes = this.#obj[propName];
		if (nodes === undefined) {
			throw new Error(`Could not find ${this.#buildExpression(propName)}.`);
		}

		const node = nodes[index];
		if (node === undefined) {
			throw new Error(`Could not find ${this.#buildExpression(propName, index)}.`);
		}

		return new Data(node, this.#buildExpression(propName, index));
	}

	childValue(propName, index = 0) {
		return this.child(propName, index).value;
	}

	attribute(attrName) {
		const attribute = this.#obj.$?.[attrName];
		if (attribute === undefined) {
			throw new Error(`Could not get attribute ${attrName} from ${this.#expression}.`);
		}

		return attribute;
	}
}

export async function load(content) {
	const rootData = await xml2js.parseStringPromise(content, {
		tagNameProcessors: [xml2js.processors.stripPrefix],
		trim: true
	}).catch((ex) => {
		ex.message = 'Could not parse XML. This likely means your import file is malformed.\n\n' + ex.message;
		throw ex;
	});

	const rssData = rootData.rss;
	if (rssData === undefined) {
		throw new Error('Could not find <rss> root node. This likely means your import file is malformed.')
	}

	return new Data(rssData, 'rss');
}
