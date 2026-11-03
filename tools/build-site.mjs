import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, stat, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.css']);
const ASSET_EXTENSION = /\.(?:css|js|mjs|svg|png|jpe?g|gif|ico|woff2|mp3)$/;

export function assertVersion(version) {
    if (!/^[A-Za-z0-9._-]+$/.test(String(version || '')))
        throw new Error(`Invalid asset version: ${version}`);
    return String(version);
}

export function defaultVersion(env = process.env) {
    return env.APP_VERSION || env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || 'dev';
}

function addVersion(reference, version) {
    if (/[?&]v=/.test(reference))
        return reference;
    const hashIndex = reference.indexOf('#');
    const beforeHash = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
    const hash = hashIndex === -1 ? '' : reference.slice(hashIndex);
    return `${beforeHash}${beforeHash.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}${hash}`;
}

function versionModuleSpecifier(specifier, version) {
    if (!specifier.startsWith('./') && !specifier.startsWith('../') && !specifier.startsWith('@win95/'))
        return specifier;
    if (!specifier.split(/[?#]/)[0].endsWith('.js'))
        return specifier;
    return addVersion(specifier, version);
}

export function versionJavaScript(source, version) {
    assertVersion(version);
    let output = String(source);
    output = output.replace(/\b(from\s*['"])([^'"]+)(['"])/g,
        (match, prefix, specifier, quote) => prefix + versionModuleSpecifier(specifier, version) + quote);
    output = output.replace(/\b(import\s*\(\s*['"])([^'"]+)(['"]\s*\))/g,
        (match, prefix, specifier, suffix) => prefix + versionModuleSpecifier(specifier, version) + suffix);
    output = output.replace(/\b(import\s+['"])([^'"]+)(['"])/g,
        (match, prefix, specifier, quote) => prefix + versionModuleSpecifier(specifier, version) + quote);
    output = output.replace(/(['"`])(\.\/assets\/[^'"`]+\.(?:mp3|svg|png|jpe?g|gif|woff2))\1/g,
        (match, quote, reference) => quote + addVersion(reference, version) + quote);
    return output;
}

export function versionHtml(source, version) {
    assertVersion(version);
    return String(source).replace(/\b(href|src)=(["'])([^"']+)\2/g, (match, attribute, quote, reference) => {
        if (!reference.startsWith('./') || !ASSET_EXTENSION.test(reference.split(/[?#]/)[0]))
            return match;
        return `${attribute}=${quote}${addVersion(reference, version)}${quote}`;
    });
}

export function versionCss(source, version) {
    assertVersion(version);
    return String(source).replace(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g, (match, quote, reference) => {
        const value = reference.trim();
        if (value.startsWith('data:') || value.startsWith('http:') || value.startsWith('https:') || value.startsWith('#'))
            return match;
        if (!ASSET_EXTENSION.test(value.split(/[?#]/)[0]) && !/\.(?:woff|ttf)$/.test(value.split(/[?#]/)[0]))
            return match;
        return `url(${quote}${addVersion(value, version)}${quote})`;
    });
}

export function versionText(source, extension, version) {
    if (extension === '.html')
        return versionHtml(source, version);
    if (extension === '.css')
        return versionCss(source, version);
    return versionJavaScript(source, version);
}

async function walk(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    const files = [];
    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory())
            files.push(...await walk(fullPath));
        else if (entry.isFile())
            files.push(fullPath);
    }
    return files;
}

/* Resolve symlinks even when the output (or one of its parents) does not exist. */
async function realDestination(destination) {
    const missing = [];
    for (;;) {
        try {
            return path.resolve(await realpath(destination), ...missing);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
            const parent = path.dirname(destination);
            if (parent === destination)
                throw error;
            missing.unshift(path.basename(destination));
            destination = parent;
        }
    }
}

function containsPath(parent, candidate) {
    const relative = path.relative(parent, candidate);
    return relative === '' || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative));
}

export async function buildSite({ source = 'src', output = '_site', version = defaultVersion() } = {}) {
    assertVersion(version);
    const sourceDir = path.resolve(source);
    const outputDir = path.resolve(output);
    const separate = (a, b) => !containsPath(a, b) && !containsPath(b, a);
    if (!separate(sourceDir, outputDir))
        throw new Error('Build output must be separate from the source directory');
    if (!(await stat(sourceDir)).isDirectory())
        throw new Error('Build source must be a directory');
    if (!separate(await realpath(sourceDir), await realDestination(outputDir)))
        throw new Error('Build output must be separate from the source directory');

    /* Build beside the destination, keeping the previous release until all reads
       and transformations succeed. Rename within one directory also avoids a
       cross-device move; a failed swap restores the previous release. */
    const parent = path.dirname(outputDir), name = path.basename(outputDir);
    await mkdir(parent, { recursive: true });
    const staging = await mkdtemp(path.join(parent, `.${name}-build-`));
    const previous = path.join(parent, `.${name}-previous-${randomUUID()}`);
    let files = 0, versionedFiles = 0, committed = false, hadPrevious = false;
    try {
        for (const file of await walk(sourceDir)) {
            const relative = path.relative(sourceDir, file);
            const destination = path.join(staging, relative);
            await mkdir(path.dirname(destination), { recursive: true });
            const extension = path.extname(file).toLowerCase();
            if (TEXT_EXTENSIONS.has(extension)) {
                const original = await readFile(file, 'utf8');
                const transformed = versionText(original, extension, version);
                await writeFile(destination, transformed);
                if (transformed !== original)
                    versionedFiles++;
            }
            else {
                await copyFile(file, destination);
            }
            files++;
        }
        try {
            await rename(outputDir, previous);
            hadPrevious = true;
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
        try {
            await rename(staging, outputDir);
        }
        catch (error) {
            if (hadPrevious) {
                try { await rename(previous, outputDir); }
                catch (restoreError) { throw new AggregateError([error, restoreError], `Build failed; previous output is at ${previous}`); }
            }
            throw error;
        }
        committed = true;
        if (hadPrevious)
            await rm(previous, { recursive: true, force: true });
        return { files, versionedFiles, outputDir };
    }
    finally {
        if (!committed)
            await rm(staging, { recursive: true, force: true });
    }
}

function parseArgs(argv) {
    const options = { source: 'src', output: '_site', version: defaultVersion() };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--source')
            options.source = argv[++i];
        else if (argv[i] === '--output')
            options.output = argv[++i];
        else if (argv[i] === '--version')
            options.version = argv[++i];
        else
            throw new Error(`Unknown argument: ${argv[i]}`);
    }
    return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const result = await buildSite(parseArgs(process.argv.slice(2)));
    console.log(`Built ${result.files} files (${result.versionedFiles} versioned) into ${result.outputDir}`);
}
