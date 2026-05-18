window.CHURCH_RENDER_CONFIG = {
  // After Cloud Run is deployed, paste its render URL here.
  // Example: https://church-render-abc123-uc.a.run.app/render
  renderUrl: '',

  // This should stay pointed at the public GitHub Pages version of the scene.
  pageUrl: 'https://jrdn-r.github.io/Church-Graphic/',

  // Cloud render defaults. 1080p30 is a safer first target than 1080p60.
  duration: 15,
  fps: 30,
  width: 1920,
  height: 1080,
  bitrate: 8000000,

  // If renderUrl is blank, the original in-browser exporter is left alone.
  useCloudExport: true
};
