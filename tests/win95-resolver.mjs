import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packages = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'packages');

/**
 * Resolves the browser import map's `@win95/*` specifiers for Node tests, so a
 * test can import an app module (which uses the bare names) without a bundler
 * or a populated node_modules.
 */
export async function resolve(specifier, context, nextResolve) {
    const match = /^@win95\/([^/]+)(?:\/(.+))?$/.exec(specifier);
    if (match) {
        const target = path.join(packages, match[1], match[2] || 'index.js');
        return { url: pathToFileURL(target).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
}
