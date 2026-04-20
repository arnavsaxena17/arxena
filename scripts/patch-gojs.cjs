#!/usr/bin/env node
/**
 * patch-gojs.cjs
 *
 * Neutralizes GoJS license-enforcement backdoors in node_modules.
 *
 * Background
 * ----------
 * GoJS 3.x ships three kill-switch mechanisms in its minified bundles:
 *
 *  1. Diagram.RP() – static function called on first Diagram construction.
 *     It creates a watermark <canvas> and, when the license check fails,
 *     executes:  Transform.prototype.Ci = Transform.prototype.Mu
 *     Mu is a deliberately broken inverse-transform that distorts every
 *     coordinate by 1.25× / 1.2×, making hit-testing and layout unusable.
 *
 *  2. Diagram.IO() – alternate license path with the same assignment.
 *
 *  3. Rendering-path kill switch – two sites in the paint loop that run
 *     Transform.prototype.Ci = Transform.prototype.Mu when the license
 *     validator returns an unexpected value.
 *
 * This script surgically replaces those assignments with no-ops and
 * replaces Diagram.RP / Diagram.IO with empty arrow functions so the
 * watermark canvas is never created.
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

const KILL_SWITCH = 'Transform.prototype.Ci=Transform.prototype.Mu';
const NOOP_EXPR   = '(0)'; // safe no-op expression

// Debug bundles use different internal names:
//   RP→Yk, IO→KO, Ph→Aa (static), Ph()→Aa() (DiagramHelper method),
//   jw→Zw, Ci→De, Mu→Lu
const DEBUG_NAMES = {
  KILL_SWITCH: 'Transform.prototype.De=Transform.prototype.Lu',
  RP_FN:       'static Yk=()=>{',
  IO_PREFIX:   'static KO=',
  IO_FN:       'static KO=()=>{',
  PH_ORIG:     'Aa(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),this.ke===null&&this.UO(t,!0),0<this.ke&&this!==this.zL}',
  PH_PATCHED:  'Aa(t,i){return i.setTransform(t.te/2,0,0,t.te/2,0,0),i.commitTransform(),!1}',
};

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

  // ── 1. Neutralize Diagram.RP ─────────────────────────────────────────
  const rpStart = src.indexOf('static RP=()=>{');
  const ioStart = src.indexOf('static IO=');
  if (rpStart > 0 && ioStart > rpStart) {
    src = src.slice(0, rpStart) + 'static RP=()=>{};' + src.slice(ioStart);
  }

  // ── 2. Neutralize Diagram.IO ─────────────────────────────────────────
  const ioFnStart = src.indexOf('static IO=()=>{');
  const diagHelperStart = src.indexOf('class DiagramHelper{', ioFnStart);
  if (ioFnStart > 0 && diagHelperStart > ioFnStart) {
    // Keep the final '}' that closes the enclosing Diagram class
    src = src.slice(0, ioFnStart) + 'static IO=()=>{};' + src.slice(diagHelperStart - 1);
  }

  // ── 3. Patch DiagramHelper.Ph() to always return false ───────────────
  // EO() (the license validator) has an early-return branch when no key is
  // set that leaves xi = true for localhost/dev URLs.  That causes Ph() to
  // return true, triggering dp() = ctx.drawImage(Diagram.Ph, …).  Making
  // Ph() unconditionally return false keeps the required canvas-transform
  // side-effects but prevents the watermark drawImage from ever being called.
  const PH_ORIG    = 'Ph(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),this.xi===null&&this.EO(t,!0),0<this.xi&&this!==this.RT}';
  const PH_PATCHED = 'Ph(t,e){return e.setTransform(t.$e/2,0,0,t.$e/2,0,0),e.commitTransform(),!1}';
  if (src.includes(PH_ORIG)) {
    src = src.split(PH_ORIG).join(PH_PATCHED);
  }

  // ── 4. Debug bundles use different internal names — patch those too ─────
  const isDebug =
    filePath.endsWith('go-debug.mjs') ||
    filePath.endsWith('go-debug.js') ||
    filePath.endsWith('go-debug-module.js');
  if (isDebug) {
    // Yk = RP, KO = IO, Aa() = Ph() method, De/Lu = Ci/Mu
    const ykStart = src.indexOf('static Yk=()=>{');
    const koPrefix = src.indexOf('static KO=');
    if (ykStart > 0 && koPrefix > ykStart)
      src = src.slice(0, ykStart) + 'static Yk=()=>{};' + src.slice(koPrefix);

    const koStart = src.indexOf('static KO=()=>{');
    const dhStart = src.indexOf('class DiagramHelper{', koStart);
    if (koStart > 0 && dhStart > koStart)
      src = src.slice(0, koStart) + 'static KO=()=>{};' + src.slice(dhStart - 1);

    if (src.includes(DEBUG_NAMES.PH_ORIG))
      src = src.split(DEBUG_NAMES.PH_ORIG).join(DEBUG_NAMES.PH_PATCHED);

    src = src.split(DEBUG_NAMES.KILL_SWITCH).join(NOOP_EXPR);
  }

  // ── 5. Neutralize remaining production-build kill switches ───────────
  const remaining = (src.match(new RegExp(KILL_SWITCH.replace(/\./g, '\\.'), 'g')) || []).length;
  if (remaining > 0) {
    src = src.split(KILL_SWITCH).join(NOOP_EXPR);
  }

  if (src === original) {
    console.log(`[patch-gojs] already patched or pattern not found: ${path.basename(filePath)}`);
    continue;
  }

  const leftover = (src.match(new RegExp(KILL_SWITCH.replace(/\./g, '\\.'), 'g')) || []).length;
  if (leftover > 0) {
    console.error(`[patch-gojs] ERROR: ${leftover} kill switches still present in ${path.basename(filePath)}`);
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
