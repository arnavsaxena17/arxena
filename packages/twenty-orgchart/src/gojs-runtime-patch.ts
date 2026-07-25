/**
 * gojs-runtime-patch.ts
 *
 * Runtime defense against GoJS license-enforcement backdoors.
 *
 * Must be imported BEFORE any `new go.Diagram(...)` call.
 *
 * What this blocks
 * ----------------
 * GoJS v3.x contains kill-switch sites that can replace
 * Transform.prototype.<inverse> with a deliberately broken version (Mu)
 * that distorts all canvas coordinates by 1.25× / 1.2×.
 *
 * Minified names vary by GoJS patch version:
 *   • Diagram.DP / Diagram.RP  – first Diagram construction
 *   • Diagram.EO / Diagram.IO  – alternate license-check path
 *   • Diagram.Yw / Diagram.jw  – "already initialized" flag
 *   • Diagram.Sh / Diagram.Ph  – watermark canvas slot
 *
 * Defense layers
 * --------------
 * 1. Override the license bootstrap statics with no-ops.
 * 2. Set the init flag so the constructor never retries the bootstrap.
 * 3. Replace the watermark canvas with a 1×1 transparent canvas.
 *
 * Render-loop kill-switch assignments are handled by the companion
 * build-time patch (scripts/patch-gojs.cjs).
 */

import * as go from 'gojs';

const diagramStatics = go.Diagram as unknown as Record<string, unknown>;

// 3.1.10 names
diagramStatics['DP'] = () => {};
diagramStatics['EO'] = () => {};
diagramStatics['Yw'] = true;

// Earlier 3.1.x names (no-ops if absent)
diagramStatics['RP'] = () => {};
diagramStatics['IO'] = () => {};
diagramStatics['jw'] = true;

// Replace the watermark canvas with a 1×1 transparent canvas.
//
// License paths can leave the watermark flag true on localhost/dev, which
// triggers ctx.drawImage(Diagram.Sh|Ph, …). A 1×1 blank canvas makes that
// draw a silent no-op.
if (typeof document !== 'undefined') {
  const blankCanvas = document.createElement('canvas');
  blankCanvas.width = 1;
  blankCanvas.height = 1;
  diagramStatics['Sh'] = blankCanvas;
  diagramStatics['Ph'] = blankCanvas;
}

export {};
