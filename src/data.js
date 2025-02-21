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

	#getPropArray(propName, isRequired) {
		const propArray = this.#obj[propName];
		if (propArray === undefined && isRequired) {
			throw new Error(`Could not find ${this.#buildExpression(propName)}.`);
		}

		return propArray;
	}

	getAll(propName, isRequired = true) {
		const propArray = this.#getPropArray(propName, isRequired);
		return propArray !== undefined ? propArray.map((value, index) => new Data(value, this.#buildExpression(propName, index))) : undefined;
	}

	getSingle(propName, index, isRequired = true) {
		const prop = (this.#getPropArray(propName, isRequired) ?? [])[index];

		if (prop === undefined && isRequired) {
			throw new Error(`Could not find ${this.#buildExpression(propName, index)}.`)
		}

		return prop !== undefined ? new Data(prop, this.#buildExpression(propName, index)) : undefined;
	}

	getAttribute(attrName) {
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
