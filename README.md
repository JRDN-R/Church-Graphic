# Church Graphic

Animated 16:9 evening church graphic for GitHub Pages.

## Browser export

Open the GitHub Pages site in Chrome or Edge, use the scene controls, then open the **Export** tab and click:

```text
Export 15 s Loop • 1080p60 MP4
```

The browser export renders a 1920 x 1080, 60 FPS, 15 second looping MP4 using the current slider values.

## Fallback export with Node + FFmpeg

Use this if the browser export does not work, or if you want a more reliable local H.264 render.

Requirements:

- Node.js
- FFmpeg installed and available on PATH

Setup:

```bash
npm install
```

In one terminal:

```bash
npm run serve
```

In another terminal:

```bash
npm run export
```

The fallback exporter renders the page frame-by-frame through Puppeteer and pipes the frames into FFmpeg. Default output:

```text
church-loop.mp4
```

Optional overrides:

```bash
SCENE_URL=http://localhost:8080/index.html OUTPUT=my-loop.mp4 npm run export
```
