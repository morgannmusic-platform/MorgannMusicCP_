#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = ['node_modules', '.git', 'assets/img', 'assets/css', 'storage'];

function isIgnored(filePath) {
  return IGNORED_DIRS.some(d => filePath.split(path.sep).includes(d));
}

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(f => {
    const p = path.join(dir, f);
    const stat = fs.statSync(p);
    if (stat && stat.isDirectory()) {
      if (!isIgnored(p)) results = results.concat(walk(p));
    } else {
      results.push(p);
    }
  });
  return results;
}

function processJSLike(content) {
  const lines = content.split(/\r?\n/);
  const out = lines.filter(line => {
    const t = line.trimStart();
    if (t.startsWith('//')) return false; // full-line comment
    return true;
  });
  return out.join('\n');
}

function processHTML(content) {
  const parts = content.split(/(<script[^>]*>)|(<\/script>)/i);
  if (parts.length === 1) return content;
  let out = '';
  let inScript = false;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    if (/^<script/i.test(p)) { out += p; inScript = true; continue; }
    if (/^<\/script>/i.test(p)) { out += p; inScript = false; continue; }
    if (inScript) {
      out += processJSLike(p);
    } else {
      out += p;
    }
  }
  return out;
}

function shouldProcess(file) {
  const ext = path.extname(file).toLowerCase();
  return ['.js', '.ts', '.html'].includes(ext) && !isIgnored(file);
}

function run(root) {
  const all = walk(root);
  const targets = all.filter(shouldProcess);
  console.log('Found', targets.length, 'files to scan.');
  targets.forEach(f => {
    try {
      const raw = fs.readFileSync(f, 'utf8');
      let out = raw;
      if (f.endsWith('.html')) out = processHTML(raw);
      else out = processJSLike(raw);
      if (out !== raw) {
        fs.writeFileSync(f, out, 'utf8');
        console.log('Updated', f);
      }
    } catch (e) {
      console.error('Error processing', f, e.message);
    }
  });
}

if (require.main === module) {
  const root = process.argv[2] || process.cwd();
  run(root);
}

module.exports = { run };
