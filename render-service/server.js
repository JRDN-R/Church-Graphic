import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 8080;
const DEFAULT_PAGE_URL = process.env.PAGE_URL || 'https://jrdn-r.github.io/Church-Graphic/';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://jrdn-r.github.io,http://localhost:5000,http://localhost:8080').split(',').map(s => s.trim()).filter(Boolean);
const MAX_FRAMES = Number(process.env.MAX_FRAMES || 900);

app.use(express.json({ limit: '1mb' }));

function setCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

app.use((req, res, next) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

function clampNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function sliderMap(settings = {}) {
  return {
    rCount: settings.starCount,
    rStarSize: settings.starSize,
    rSpeed: settings.twinkleSpeed,
    rPngSize: settings.pngSize,
    rPngX: settings.pngX,
    rPngY: settings.pngY,
    rCandleGlow: settings.candleGlow,
    rCandleFlicker: settings.candleFlicker,
    rCandleSpeed: settings.candleSpeed,
    rCandleSpread: settings.candleSpread,
    rCandleWarmth: settings.candleWarmth,
    rCandleSpill: settings.candleSpill,
    rCandleMotion: settings.candleMotion,
    rGradient: settings.gradient,
    rEdge: settings.edge,
    rBloom: settings.bloom,
    rOpac: settings.bloomOpacity
  };
}

function run(command, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) return resolve();
      reject(new Error(`${command} exited with ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

async function renderMp4({ pageUrl, settings, duration, fps, width, height, bitrate }) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'church-render-'));
  const framesDir = path.join(tmp, 'frames');
  await fs.mkdir(framesDir, { recursive: true });
  const output = path.join(tmp, 'church-loop.mp4');
  const totalFrames = Math.round(duration * fps);

  if (totalFrames > MAX_FRAMES) {
    throw new Error(`Requested ${totalFrames} frames, but MAX_FRAMES is ${MAX_FRAMES}. Lower duration/fps or raise MAX_FRAMES.`);
  }

  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage', '--no-sandbox'] });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => typeof window.renderExportFrameAt === 'function', { timeout: 30000 });
    await page.waitForFunction(() => {
      const img = document.getElementById('baseLayer');
      return img && img.complete && img.naturalWidth > 0;
    }, { timeout: 30000 });

    await page.evaluate((values) => {
      for (const [id, value] of Object.entries(values)) {
        if (value === undefined || value === null || value === '') continue;
        const el = document.getElementById(id);
        if (!el) continue;
        el.value = String(value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, sliderMap(settings));

    for (let i = 0; i < totalFrames; i++) {
      const dataUrl = await page.evaluate(({ i, totalFrames }) => window.renderExportFrameAt(i, totalFrames), { i, totalFrames });
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      const filename = path.join(framesDir, `frame_${String(i).padStart(5, '0')}.png`);
      await fs.writeFile(filename, Buffer.from(base64, 'base64'));
    }
  } finally {
    if (browser) await browser.close();
  }

  const ffmpegArgs = [
    '-y',
    '-framerate', String(fps),
    '-i', path.join(framesDir, 'frame_%05d.png'),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart'
  ];

  if (width !== 1920 || height !== 1080) {
    ffmpegArgs.push('-vf', `scale=${width}:${height}`);
  }

  if (bitrate) ffmpegArgs.push('-b:v', String(bitrate));
  ffmpegArgs.push(output);

  await run('ffmpeg', ffmpegArgs);
  return { output, tmp };
}

async function handleRender(req, res) {
  const body = req.body || {};
  const duration = clampNumber(body.duration, 15, 5, 30);
  const fps = clampNumber(body.fps, 30, 24, 60);
  const width = clampNumber(body.width, 1920, 640, 1920);
  const height = clampNumber(body.height, 1080, 360, 1080);
  const bitrate = clampNumber(body.bitrate, 8000000, 1000000, 16000000);
  const pageUrl = body.pageUrl || DEFAULT_PAGE_URL;
  const settings = body.settings || {};

  let result;
  try {
    result = await renderMp4({ pageUrl, settings, duration, fps, width, height, bitrate });
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="church-loop-${duration}s-${width}x${height}-${fps}fps.mp4"`);
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(result.output, async (err) => {
      await fs.rm(result.tmp, { recursive: true, force: true }).catch(() => {});
      if (err) console.error(err);
    });
  } catch (err) {
    if (result?.tmp) await fs.rm(result.tmp, { recursive: true, force: true }).catch(() => {});
    console.error(err);
    if (!res.headersSent) res.status(500).json({ error: err.message || 'Render failed' });
  }
}

app.post('/render', handleRender);
app.post('/api/render', handleRender);

app.listen(PORT, () => {
  console.log(`Church render service listening on ${PORT}`);
});
