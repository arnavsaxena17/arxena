/**
 * gojs-runtime-patch.ts
 *
 * Runtime defense against GoJS license-enforcement backdoors.
 *
 * Must be imported BEFORE any `new go.Diagram(...)` call.
 *
 * What this blocks
 * ----------------
 * GoJS v3.x contains three kill-switch sites that can replace
 * Transform.prototype.Ci with a deliberately broken version (Mu) that
 * distorts all canvas coordinates by 1.25× / 1.2×, making the diagram
 * effectively unusable.
 *
 *   • Diagram.RP()  – called on the very first Diagram construction
 *   • Diagram.IO()  – called via an alternate license-check path
 *   • Two render-loop sites inside the paint function
 *
 * Defense layers
 * --------------
 * 1. Override Diagram.RP and Diagram.IO with no-ops so they never run.
 * 2. Set Diagram.jw = true so the constructor never calls RP().
 *
 * The render-loop sites are handled by the companion build-time patch
 * (scripts/patch-gojs.cjs) which replaces those assignments with (0).
 */

import * as go from 'gojs';

const d = go.Diagram as unknown as Record<string, unknown>;

// Block RP: called in the Diagram constructor (first instantiation)
d['RP'] = () => {};

// Block IO: called in a special single-key license branch
d['IO'] = () => {};

// Mark as already initialised so the constructor never retries RP
d['jw'] = true;

// Replace the watermark canvas with a 1×1 transparent canvas.
//
// Why this matters:
// EO() (the license validator) has a no-license-key early-return path that
// leaves xi = true on localhost/dev servers. That causes Ph() to return true,
// which triggers dp() = ctx.drawImage(Diagram.Ph, x, y). If Ph is null the
// drawImage throws; if Ph is the real watermark canvas it renders the text.
// Substituting a 1×1 empty canvas makes dp() a silent no-op: it fires
// successfully but blits nothing visible onto the diagram.
if (typeof document !== 'undefined') {
  const blank = document.createElement('canvas');
  blank.width = 1;
  blank.height = 1;
  d['Ph'] = blank;
}

export {};
