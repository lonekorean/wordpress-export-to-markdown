import xml2js from 'xml2js';

class Data {
	#obj;
	#expression;

	constructor(obj, expression) {
		// xml2js returns leaf nodes as strings, turn those into consistent objects
		// I found this to be safer and more efficient than using the explicitCharkey option
		this.#obj = typeof obj === 'string' ? { _: obj } : obj;

		// this identifies how the object was referenced, helps a ton with debugging
		this.#expression = expression;
	}

	#buildExpression(propName, index = undefined) {
		let expression = `${this.#expression}.${propName}`;
		if (index !== undefined) {
			expression += `[${index}]`;
		}

		return expression;
	}

	// used by "optional" functions to return undefined instead of throwing an error
	#optional(func) {
		try {
			return func();
		} catch (ex) {
			return undefined;
		}
	}

	// will not throw an error if property doesn't exist, defaults to empty array
	children(propName) {
		const nodes = this.#obj[propName] ?? [];
		return nodes.map((value, index) => new Data(value, this.#buildExpression(propName, index)));
	}

	// throws an error if property (or index on property) doesn't exist
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

	// convenience function, since it's very common to want the value of a child
	childValue(propName, index = 0) {
		return this.child(propName, index).value();
	}
	
	// throws an error if this object doesn't have a value string
	value() {
		const value = this.#obj._;
		if (value === undefined) {
			throw new Error(`Could not get value from ${this.#expression}.`);
		}

		return value;
	}

	// throws an error if attribute does not exist
	attribute(attrName) {
		const attribute = this.#obj.$?.[attrName];
		if (attribute === undefined) {
			throw new Error(`Could not get attribute ${attrName} from ${this.#expression}.`);
		}

		return attribute;
	}

	optionalChild(propName, index = 0) {
		return this.#optional(() => this.child(propName, index));
	}

	optionalChildValue(propName, index = 0) {
		return this.#optional(() => this.childValue(propName, index));
	}

	optionalValue() {
		return this.#optional(() => this.value());
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
