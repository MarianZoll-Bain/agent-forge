/**
 * Window tiler service — tiles all Terminal.app windows side-by-side
 * on the current screen using JXA (osascript).
 */

import { logger } from '../logger'

export interface WindowTileResult {
  ok: true
  tiledCount: number
}

export interface WindowTileError {
  ok: false
  code: string
  message: string
}

export type WindowTileResponse = WindowTileResult | WindowTileError

const JXA_TILE_SCRIPT = `
function run() {
  ObjC.import('AppKit');

  const terminal = Application('Terminal');
  terminal.activate();

  // Collect all visible Terminal windows.
  const allWins = terminal.windows().filter(w => {
    try { return w.visible(); } catch(e) { return false; }
  });

  // Sort by window id (stable, assigned at creation time) so the
  // left-to-right order never jumps between tile operations.
  allWins.sort((a, b) => {
    try { return a.id() - b.id(); }
    catch(e) { return 0; }
  });

  // Deduplicate tabbed windows: tabs share the exact same bounds,
  // so keep only the first window per unique position.
  const seen = new Set();
  const wins = [];
  for (const w of allWins) {
    try {
      const b = w.bounds();
      const key = Math.round(b.x) + ',' + Math.round(b.y) + ',' + Math.round(b.width) + ',' + Math.round(b.height);
      if (!seen.has(key)) {
        seen.add(key);
        wins.push(w);
      }
    } catch(e) { /* skip */ }
  }

  const count = wins.length;
  if (count === 0) return JSON.stringify({ ok: true, tiledCount: 0 });

  // Determine which screen the frontmost matched window is on.
  // Terminal bounds use a global coordinate space where the primary screen
  // has origin (0,0) at top-left. NSScreen frames use bottom-left origin.
  // We find the screen whose frame contains the first window's center point.
  const allScreens = $.NSScreen.screens;
  const frontBounds = wins[0].bounds();
  const winCenterX = frontBounds.x + frontBounds.width / 2;

  // Convert window top-left y to NSScreen bottom-left y for hit-testing.
  // Primary screen height gives us the global coordinate flip reference.
  const primaryH = $.NSScreen.mainScreen.frame.size.height;
  const winCenterY_ns = primaryH - (frontBounds.y + frontBounds.height / 2);

  let targetFrame = $.NSScreen.mainScreen.frame;
  for (let i = 0; i < allScreens.count; i++) {
    const f = allScreens.objectAtIndex(i).frame;
    if (winCenterX >= f.origin.x && winCenterX < f.origin.x + f.size.width &&
        winCenterY_ns >= f.origin.y && winCenterY_ns < f.origin.y + f.size.height) {
      targetFrame = f;
      break;
    }
  }

  // Convert NSScreen frame (bottom-left origin) to Terminal bounds (top-left origin).
  // In Terminal coords: x is the same, y = primaryH - (nsY + nsH).
  const tileX = targetFrame.origin.x;
  const tileY = primaryH - (targetFrame.origin.y + targetFrame.size.height);
  const screenW = targetFrame.size.width;
  const screenH = targetFrame.size.height;

  const sliceW = Math.floor(screenW / count);
  for (let i = 0; i < count; i++) {
    const left = tileX + i * sliceW;
    const width = (i === count - 1) ? (screenW - i * sliceW) : sliceW;
    wins[i].bounds = { x: left, y: tileY, width: width, height: screenH };
  }
  return JSON.stringify({ ok: true, tiledCount: count });
}
`

export async function tileAgentTerminals(): Promise<WindowTileResponse> {
  try {
    const { execa } = await import('execa')
    const { stdout } = await execa('osascript', ['-l', 'JavaScript', '-e', JXA_TILE_SCRIPT])
    const parsed = JSON.parse(stdout) as { ok: true; tiledCount: number }
    logger.info(`windowTiler: tiled ${parsed.tiledCount} window(s)`)
    return parsed
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    logger.error(`windowTiler: failed: ${msg}`)
    return { ok: false, code: 'TILE_FAILED', message: msg }
  }
}
