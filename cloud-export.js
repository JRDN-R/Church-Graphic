(() => {
  function $(id) { return document.getElementById(id); }

  function getNumber(id, fallback) {
    const el = $(id);
    if (!el) return fallback;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : fallback;
  }

  function collectSettings() {
    return {
      starCount: getNumber('rCount', 250),
      starSize: getNumber('rStarSize', 1.6),
      twinkleSpeed: getNumber('rSpeed', 4.4),
      pngSize: getNumber('rPngSize', 0.83),
      pngX: getNumber('rPngX', -11),
      pngY: getNumber('rPngY', 11),
      candleGlow: getNumber('rCandleGlow', 0.15),
      candleFlicker: getNumber('rCandleFlicker', 0.8),
      candleSpeed: getNumber('rCandleSpeed', 0.45),
      candleSpread: getNumber('rCandleSpread', 90),
      candleWarmth: getNumber('rCandleWarmth', 1.65),
      candleSpill: getNumber('rCandleSpill', 0.2),
      candleMotion: getNumber('rCandleMotion', 0.75),
      gradient: getNumber('rGradient', 1.24),
      edge: getNumber('rEdge', 0),
      bloom: getNumber('rBloom', 0),
      bloomOpacity: getNumber('rOpac', 0)
    };
  }

  function setProgress(text, percent) {
    const prog = $('exportProgress');
    const bar = $('exportBar');
    const stat = $('exportStatus');
    if (prog) prog.style.display = 'block';
    if (bar && Number.isFinite(percent)) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (stat) stat.textContent = text;
  }

  async function exportViaCloud(event) {
    const config = window.CHURCH_RENDER_CONFIG || {};
    const renderUrl = String(config.renderUrl || '').trim();

    if (!config.useCloudExport || !renderUrl) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const btn = $('exportBtn');
    if (btn) btn.disabled = true;

    setProgress('Sending render job to Cloud Run…', 5);

    try {
      const payload = {
        pageUrl: config.pageUrl || window.location.href,
        duration: config.duration || 15,
        fps: config.fps || 30,
        width: config.width || 1920,
        height: config.height || 1080,
        bitrate: config.bitrate || 8000000,
        settings: collectSettings()
      };

      setProgress('Rendering on backend. This may take a minute or two…', 18);

      const response = await fetch(renderUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let details = '';
        try {
          const data = await response.json();
          details = data.error ? ` ${data.error}` : '';
        } catch (_) {}
        throw new Error(`Cloud render failed.${details}`);
      }

      setProgress('Downloading finished MP4…', 92);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `church-loop-${payload.duration}s-${payload.width}x${payload.height}-${payload.fps}fps.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);

      setProgress(`Done. ${(blob.size / 1048576).toFixed(1)} MB downloaded.`, 100);
    } catch (err) {
      console.error(err);
      setProgress(`Cloud export error: ${err.message}`, 0);
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function installCloudExportHook() {
    const btn = $('exportBtn');
    if (!btn) return;
    btn.addEventListener('click', exportViaCloud, true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installCloudExportHook);
  } else {
    installCloudExportHook();
  }
})();
