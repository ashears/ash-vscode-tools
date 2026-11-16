import PDFDocument from 'pdfkit';
import { mkdir, writeFile } from 'node:fs/promises';
import { png } from './png.mjs';
await mkdir('test/fixtures', { recursive: true });
await mkdir('media', { recursive: true });
await writeFile('media/icon.png', png(128, 128, (x, y) => {
  const a = y > 25 && y < 102 && ((x > 21 + (102-y)*0.36 && x < 37 + (102-y)*0.36) || (x < 107 - (102-y)*0.36 && x > 91 - (102-y)*0.36) || (y > 70 && y < 82 && x > 42 && x < 86));
  return a ? [161,232,205] : [21,32,43];
}));
const scan = png(380, 240, (x, y) => {
  const line = [50, 80, 110, 140, 170].some(top => y >= top && y < top + 5 && x > 25 && x < 330 - top / 3);
  return line ? [75,86,94] : [246,245,238];
});
async function make(name, draw, extra = {}) {
  const doc = new PDFDocument({ size: 'A4', margin: 52, info: { Title: 'Ash Tools Technical Reference', Author: 'Ash Tools test fixtures' }, ...extra });
  const chunks = []; doc.on('data', chunk => chunks.push(chunk));
  const done = new Promise((resolve, reject) => { doc.on('end', resolve); doc.on('error', reject); });
  draw(doc); doc.end(); await done; await writeFile(`test/fixtures/${name}.pdf`, Buffer.concat(chunks));
}
await make('reference', doc => {
  doc.fillColor('#173d36').font('Helvetica-Bold').fontSize(12).text('ASH TOOLS  /  ENGINEERING NOTES');
  doc.moveDown(1.5).fillColor('#182532').fontSize(30).text('Reliable retry design');
  doc.moveDown(.4).font('Helvetica').fontSize(11).fillColor('#566674').text('A local fixture for reading, searching, and citing technical references.');
  doc.moveDown(2).font('Helvetica-Bold').fontSize(17).fillColor('#182532').text('1. Retry policy');
  doc.outline.addItem('1. Retry policy');
  doc.moveDown(.5).font('Helvetica').fontSize(12).text('Use exponential backoff with jitter for transient errors. The initial delay is 250 milliseconds. Cap the delay at 8 seconds and stop after 5 attempts.', { lineGap: 5 });
  doc.moveDown().text('Never retry authentication failures. Respect cancellation and return a useful error when the operation deadline expires.', { lineGap: 5 });
  doc.moveDown(2).font('Helvetica-Bold').fontSize(17).text('Implementation checklist');
  doc.moveDown(.5).font('Helvetica').fontSize(12).text('1. Classify the error.\n2. Calculate a bounded delay.\n3. Wait with cancellation support.\n4. Record the result without exposing credentials.', { lineGap: 8 });
  doc.addPage(); doc.outline.addItem('2. Request budget');
  doc.font('Helvetica-Bold').fontSize(25).text('2. Request budget');
  doc.moveDown().font('Helvetica').fontSize(12).text('A single operation has a 30 second deadline. Retries share that deadline. The retry policy must never multiply the allowed total time.', { lineGap: 5 });
  doc.moveDown().text('For Copilot verification: the answer to the initial delay question is on physical page 1. The operation deadline is on physical page 2.');
  doc.link(52, 400, 240, 20, 'https://code.visualstudio.com/');
});
await make('columns', doc => {
  doc.fontSize(16).text('Two-column layout');
  doc.fontSize(11).text('LEFT column: alpha beta gamma. Text ordering is not guaranteed.', 52, 130, { width: 210 });
  doc.text('RIGHT column: delta epsilon zeta. Verify the original visual layout.', 330, 130, { width: 210 });
});
await make('scanned', doc => { doc.image(scan, 52, 80, { width: 480 }); });
await make('protected', doc => { doc.text('This document requires a password.'); }, { userPassword: 'test-password', ownerPassword: 'test-owner', pdfVersion: '1.7' });
await make('large', doc => { for (let page = 1; page <= 80; page++) { if (page > 1) doc.addPage(); doc.text(`Physical page ${page}. Repeated needle for search truncation.`); } });
await make('dense', doc => { doc.fontSize(1).text('bounded-text '.repeat(6000), { width: 480, height: 700, lineBreak: false }); });
await writeFile('test/fixtures/malformed.pdf', 'This is deliberately not a PDF.');
console.log('Generated original, redistributable PDF fixtures and icon.');
