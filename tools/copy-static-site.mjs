import { cp, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const staticDirectories = ['admin', 'articles', 'data', 'images', 'js'];
const staticFiles = ['script.js', 'style.css'];

await Promise.all(
    staticDirectories.map((directory) =>
        cp(resolve(directory), resolve('dist', directory), { recursive: true })
    )
);

await Promise.all(
    staticFiles.map((file) => copyFile(resolve(file), resolve('dist', file)))
);
