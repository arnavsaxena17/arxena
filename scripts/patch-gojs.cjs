#!/usr/bin/env node
/**
 * patch-gojs.cjs
 *
 * Neutralizes GoJS license-enforcement backdoors in node_modules.
 *
 * Background
 * ----------
 * GoJS 3.x ships kill-switch mechanisms in its minified bundles that can:
 *  - create a watermark <canvas>
 *  - replace Transform.prototype.<inverse> with a deliberately broken
 *    Transform.prototype.Mu that distorts coordinates by 1.25× / 1.2×
 *
 * Minified symbol names change between GoJS patch versions, so this script
 * tries known name sets (3.1.0-era and 3.1.10-era) for each site.
 *
 * Files patched: release/go.mjs
 *                release/go.js
 *                release/go-module.js
 *                release/go-debug.mjs
 *                release/go-debug.js
 *                release/go-debug-module.js
 */

const fs = require('fs');
const path = require('path');

const NOOP_EXPR = '(0)'; // safe no-op expression

// Production / debug kill-switch assignments seen across GoJS 3.1.x
const KILL_SWITCHES = [
  'Transform.prototype.Ni=Transform.prototype.Mu', // 3.1.10
  'Transform.prototype.Ci=Transform.prototype.Mu', // earlier 3.1.x
  'Transform.prototype.De=Transform.prototype.Lu', // earlier debug
];

/** Replace a minified `static Name=()=>{ ... }` with a no-op, preserving surrounding syntax. */
function replaceStaticArrowMethod(src, signature, replacement) {
  const start = src.indexOf(signature);
  if (start < 0) return src;

  const openBrace = start + signature.length - 1;
  if (src[openBrace] !== '{') return src;

  let depth = 0;
  for (let i = openBrace; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') {
      depth--;
      if (depth === 0) {
        return src.slice(0, start) + replacement + src.slice(i + 1);
      }
    }
  }

  return src;
}

// Watermark helper: keep setTransform side-effects, always return false
const PH_REPLACEMENTS = [
  // 3.1.10 production (Sh)
  {
    from: 'Sh(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),this.bi===null&&this.UO(t,!0),0<this.bi&&this!==this.OT}',
    to: 'Sh(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),!1}',
  },
  // earlier 3.1.x production (Ph)
  {
    from: 'Ph(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),this.xi===null&&this.EO(t,!0),0<this.xi&&this!==this.RT}',
    to: 'Ph(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),!1}',
  },
  // 3.1.10 debug (La)
  {
    from: 'La(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),this.Pe===null&&this.GO(t,!0),0<this.Pe&&this!==this.XL}',
    to: 'La(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),!1}',
  },
  // earlier debug (Aa)
  {
    from: 'Aa(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),this.ke===null&&this.UO(t,!0),0<this.ke&&this!==this.zL}',
    to: 'Aa(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),!1}',
  },
];

// License bootstrap statics that create the watermark canvas
const LICENSE_STATICS = [
  // 3.1.10 production: DP (was RP), EO (was the IO function)
  { signature: 'static DP=()=>{', replacement: 'static DP=()=>{};' },
  { signature: 'static EO=()=>{', replacement: 'static EO=()=>{};' },
  // earlier 3.1.x production
  { signature: 'static RP=()=>{', replacement: 'static RP=()=>{};' },
  { signature: 'static IO=()=>{', replacement: 'static IO=()=>{};' },
  // 3.1.10 debug: Bk (was RP/DP), UO (was EO)
  { signature: 'static Bk=()=>{', replacement: 'static Bk=()=>{};' },
  { signature: 'static UO=()=>{', replacement: 'static UO=()=>{};' },
  // earlier debug
  { signature: 'static Yk=()=>{', replacement: 'static Yk=()=>{};' },
  { signature: 'static KO=()=>{', replacement: 'static KO=()=>{};' },
];

const files = [
  path.join(__dirname, '../node_modules/gojs/release/go.mjs'),
  path.join(__dirname, '../node_modules/gojs/release/go.js'),
  path.join(__dirname, '../node_modules/gojs/release/go-module.js'),
  path.join(__dirname, '../node_modules/gojs/release/go-debug.mjs'),
  path.join(__dirname, '../node_modules/gojs/release/go-debug.js'),
  path.join(__dirname, '../node_modules/gojs/release/go-debug-module.js'),
];

let totalPatched = 0;

for (const filePath of files) {
  if (!fs.existsSync(filePath)) {
    console.log(`[patch-gojs] skipping (not found): ${path.basename(filePath)}`);
    continue;
  }

  let src = fs.readFileSync(filePath, 'utf8');
  const original = src;

  for (const { signature, replacement } of LICENSE_STATICS) {
    src = replaceStaticArrowMethod(src, signature, replacement);
  }

  for (const { from, to } of PH_REPLACEMENTS) {
    if (src.includes(from)) {
      src = src.split(from).join(to);
    }
  }

  for (const killSwitch of KILL_SWITCHES) {
    if (src.includes(killSwitch)) {
      src = src.split(killSwitch).join(NOOP_EXPR);
    }
  }

  if (src === original) {
    console.log(
      `[patch-gojs] already patched or pattern not found: ${path.basename(filePath)}`,
    );
    continue;
  }

  const leftover = KILL_SWITCHES.reduce(
    (count, killSwitch) =>
      count +
      (
        src.match(new RegExp(killSwitch.replace(/\./g, '\\.'), 'g')) || []
      ).length,
    0,
  );
  if (leftover > 0) {
    console.error(
      `[patch-gojs] ERROR: ${leftover} kill switches still present in ${path.basename(filePath)}`,
    );
    process.exitCode = 1;
    continue;
  }

  fs.writeFileSync(filePath, src, 'utf8');
  totalPatched++;
  console.log(`[patch-gojs] patched ${path.basename(filePath)} ✓`);
}

if (totalPatched > 0) {
  console.log(`[patch-gojs] done – ${totalPatched} file(s) patched.`);
} else {
  console.log('[patch-gojs] nothing to do.');
}
