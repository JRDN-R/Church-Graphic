# Church Graphic Cloud Render Service

This folder contains the backend renderer for the GitHub Pages export button.

The goal is:

```text
GitHub Pages Export button
→ Cloud Run backend
→ backend opens the scene in headless Chromium
→ backend renders frames
→ FFmpeg creates an MP4
→ browser downloads the finished video
```

## One-time Google/Firebase setup

Install and sign in:

```bash
npm install -g firebase-tools
gcloud auth login
firebase login
```

Create or select a Firebase / Google Cloud project in the Firebase console, then set your project ID:

```bash
gcloud config set project YOUR_PROJECT_ID
```

Enable required APIs:

```bash
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
```

## Deploy to Cloud Run

From the repo root:

```bash
gcloud run deploy church-graphic-render \
  --source ./render-service \
  --region us-central1 \
  --allow-unauthenticated \
  --memory 4Gi \
  --cpu 2 \
  --timeout 900 \
  --set-env-vars PAGE_URL=https://jrdn-r.github.io/Church-Graphic/,ALLOWED_ORIGINS=https://jrdn-r.github.io
```

When deployment finishes, Google will print a Service URL like:

```text
https://church-graphic-render-xxxxx-uc.a.run.app
```

Open this to test health:

```text
https://church-graphic-render-xxxxx-uc.a.run.app/health
```

You should see:

```json
{"ok":true}
```

## Connect the webpage button

Edit the repo file:

```text
render-config.js
```

Set:

```js
renderUrl: 'https://YOUR-CLOUD-RUN-URL/render'
```

Example:

```js
renderUrl: 'https://church-graphic-render-xxxxx-uc.a.run.app/render'
```

After GitHub Pages refreshes, the Export button will send the current slider settings to Cloud Run and download the returned MP4.

## Safer first settings

The frontend defaults to:

```text
1080p
30fps
15 seconds
8 Mbps
```

That is intentionally lighter than 1080p60. After it works reliably, you can raise `fps` in `render-config.js` to 60.

## Important

This first version returns the MP4 directly from Cloud Run. If the file becomes too large or renders take too long, the next version should upload the MP4 to Cloud Storage and return a signed download URL instead.
