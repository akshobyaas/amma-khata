import qrcode from './vendor/qrcode.js';
import { inr } from './format.js';

// Dark/light grid for a QR code of `text` (error correction M).
export function qrModules(text) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

// A PNG of the QR with the amount written under it, ready to share on WhatsApp.
export async function qrPng(text, amount) {
  const grid = qrModules(text);
  const cell = 12, quiet = 4, n = grid.length;
  const side = (n + quiet * 2) * cell;
  const canvas = document.createElement('canvas');
  canvas.width = side; canvas.height = side + 90;
  const g = canvas.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#000';
  grid.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) g.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
  }));
  g.fillStyle = '#23305A';
  g.font = '600 44px sans-serif';
  g.textAlign = 'center';
  g.fillText('Amma Khata · ' + inr(amount), side / 2, side + 50);
  return new Promise(res => canvas.toBlob(res, 'image/png'));
}
