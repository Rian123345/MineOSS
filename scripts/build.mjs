// Build-Skript: bündelt Client (React) und Server mit esbuild.
//   node scripts/build.mjs           → Produktions-Build nach dist/
//   node scripts/build.mjs --watch   → nur Client, mit automatischem Neubau (für npm run dev)
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outPublic = path.join(root, 'dist', 'public');
const watch = process.argv.includes('--watch');
const BUILD_ID = watch ? 'dev' : `${Date.now().toString(36)}`;

fs.mkdirSync(outPublic, { recursive: true });

function writeIndex(metafile) {
  const outputs = Object.keys(metafile.outputs).map((p) => path.relative(outPublic, path.join(root, p)).replaceAll('\\', '/'));
  const js = outputs.find((o) => /^main-.*\.js$/.test(o));
  const css = outputs.find((o) => /^main-.*\.css$/.test(o));
  const tpl = fs.readFileSync(path.join(root, 'client', 'index.html'), 'utf8');
  const html = tpl
    .replace('<!--CSS-->', css ? `<link rel="stylesheet" href="/${css}">` : '')
    .replace('<!--JS-->', `<script type="module" src="/${js}"></script>`);
  fs.writeFileSync(path.join(outPublic, 'index.html'), html);
  fs.copyFileSync(path.join(root, 'client', 'favicon.png'), path.join(outPublic, 'favicon.png'));
  // Bilder (Hintergrund, Minecraft-Texturen) kopieren
  fs.cpSync(path.join(root, 'client', 'assets'), outPublic, { recursive: true });
  // Eigene Sounddateien (z. B. sounds/xp/startup.mp3) → Liste für den Client
  const soundDir = path.join(root, 'client', 'assets', 'sounds');
  const sounds = [];
  const walk = (d, rel) => {
    if (!fs.existsSync(d)) return;
    for (const f of fs.readdirSync(d, { withFileTypes: true })) {
      if (f.isDirectory()) walk(path.join(d, f.name), rel + f.name + '/');
      else if (/\.(mp3|wav|ogg)$/i.test(f.name)) sounds.push(rel + f.name);
    }
  };
  walk(soundDir, '');
  fs.mkdirSync(path.join(outPublic, 'sounds'), { recursive: true });
  fs.writeFileSync(path.join(outPublic, 'sounds', 'index.json'), JSON.stringify(sounds));
  // Minecraft-Texturen: liegen gebündelt in client/mc-textures.json → einzelne PNG-Dateien
  const pack = path.join(root, 'client', 'mc-textures.json');
  if (fs.existsSync(pack)) {
    const mcDir = path.join(outPublic, 'mc');
    fs.mkdirSync(mcDir, { recursive: true });
    for (const [id, b64] of Object.entries(JSON.parse(fs.readFileSync(pack, 'utf8')))) {
      fs.writeFileSync(path.join(mcDir, id + '.png'), Buffer.from(b64, 'base64'));
    }
  }
}

function cleanOld() {
  for (const f of fs.readdirSync(outPublic)) {
    if (/^main-.*\.(js|css)(\.map)?$/.test(f)) fs.rmSync(path.join(outPublic, f));
  }
}

const clientOptions = {
  entryPoints: { main: path.join(root, 'client', 'main.tsx') },
  bundle: true,
  outdir: outPublic,
  entryNames: '[name]-[hash]',
  format: 'esm',
  target: ['chrome100', 'firefox100', 'safari15', 'edge100'],
  jsx: 'automatic',
  minify: !watch,
  sourcemap: watch ? 'inline' : false,
  metafile: true,
  loader: { '.png': 'dataurl', '.svg': 'text' },
  external: ['/wallpaper.jpg'],
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production'), __MINEOS_BUILD__: JSON.stringify(BUILD_ID) },
  logLevel: 'info',
};

if (watch) {
  const ctx = await esbuild.context({
    ...clientOptions,
    plugins: [{
      name: 'index-writer',
      setup(build) {
        build.onStart(() => cleanOld());
        build.onEnd((r) => { if (r.metafile) writeIndex(r.metafile); });
      },
    }],
  });
  await ctx.watch();
  console.log('[build] Client wird beobachtet …');
} else {
  cleanOld();
  const r = await esbuild.build(clientOptions);
  writeIndex(r.metafile);

  await esbuild.build({
    entryPoints: [path.join(root, 'server', 'index.ts')],
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outfile: path.join(root, 'dist', 'server.js'),
    define: { __MINEOS_BUILD__: JSON.stringify(BUILD_ID) },
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: 'info',
  });
  // Notfall-Werkzeug (Admin ernennen / Passwort setzen) ohne npm nutzbar
  await esbuild.build({
    entryPoints: [path.join(root, 'scripts', 'make-admin.ts')],
    bundle: true, platform: 'node', format: 'esm', target: 'node22',
    outfile: path.join(root, 'dist', 'tools.js'),
    banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
    logLevel: 'warning',
  });
  console.log('\n✔ Build abgeschlossen. Starten mit:  npm start\n');
}
