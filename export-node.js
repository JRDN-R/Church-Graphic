#!/usr/bin/env node
/**
 * export-node.js
 *
 * Guaranteed H.264 MP4 fallback exporter for the Church Graphic page.
 * It renders the same 1920x1080 / 60 FPS / 15 second loop frame-by-frame
 * through Puppeteer, then pipes PNG frames into FFmpeg.
 *
 * Setup:
 *   npm install
 *   Make sure ffmpeg is installed and available on PATH.
 *
 * Usage:
 *   npm run serve
 *   npm run export
 *
 * Optional environment variables:
 *   SCENE_URL=http://localhost:8080/index.html
 *   OUTPUT=church-loop.mp4
 */

const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');

const URL = process.env.SCENE_URL || 'http://localhost:8080/index.html';
const FPS = 60;
const DURATION = 15;
const TOTAL = FPS * DURATION;
const OUT_W = 1920;
const OUT_H = 1080;
const OUTPUT = process.env.OUTPUT || 'church-loop.mp4';

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: OUT_W, height: OUT_H, deviceScaleFactor: 1 });

    console.log(`Loading ${URL}...`);
    await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });

    await page.evaluate(() => {
      const panel = document.getElementById('panel');
      if (panel) panel.style.display = 'none';
      document.documentElement.style.setProperty('--panel-h', '0px');
      window.dispatchEvent(new Event('resize'));
    });

    await page.waitForFunction(() => {
      const img = document.getElementById('baseLayer');
      return img && img.complete && img.naturalWidth > 0 && typeof window.renderExportFrameAt === 'function';
    }, { timeout: 30000 });

    await wait(750);

    console.log('Starting FFmpeg...');
    const ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'image2pipe',
      '-framerate', String(FPS),
      '-i', '-',
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'slow',
      '-crf', '18',
      '-r', String(FPS),
      '-movflags', '+faststart',
      OUTPUT
    ], { stdio: ['pipe', 'inherit', 'inherit'] });

    ffmpeg.on('error', error => {
      console.error('FFmpeg failed to start:', error.message);
      process.exit(1);
    });

    console.log(`Rendering ${TOTAL} frames...`);
    for (let i = 0; i < TOTAL; i++) {
      const dataUrl = await page.evaluate((frameIndex, totalFrames) => {
        return window.renderExportFrameAt(frameIndex, totalFrames);
      }, i, TOTAL);

      const frame = Buffer.from(dataUrl.replace(/^data:image\/png;base64,/, ''), 'base64');
      ffmpeg.stdin.write(frame);

      if (i % FPS === 0 || i === TOTAL - 1) {
        const pct = Math.round(((i + 1) / TOTAL) * 100);
        console.log(`  frame ${i + 1} / ${TOTAL} (${pct}%)`);
      }
    }

    ffmpeg.stdin.end();

    await new Promise((resolve, reject) => {
      ffmpeg.on('close', code => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
    });

    console.log(`\nDone -> ${path.resolve(OUTPUT)}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
