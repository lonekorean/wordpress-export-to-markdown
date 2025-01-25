import fs from 'fs';
import path from 'path';

export function boolean(value) {
    if (typeof value === 'boolean') {
        return value;
    } else if (value === 'true') {
        return true;
    } else if (value === 'false') {
        return false;
    }

    throw 'Must be true or false.';
}

export function filePath(value) {
    const unwrapped = value.replace(/"(.*?)"/, '$1');
    const absolute = path.resolve(unwrapped);

    let fileExists;
    try {
        fileExists = fs.existsSync(absolute) && fs.statSync(absolute).isFile();
    } catch (ex) {
        fileExists = false;
    }

    if (fileExists) {
        return absolute;
    } else {
        throw 'File not found at ' + absolute + '.';
    }
}
