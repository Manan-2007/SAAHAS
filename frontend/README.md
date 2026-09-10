<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/d3d3e06b-fe53-43b8-ba76-56052b69f57a

## Run Locally

**Prerequisites:**  Node.js, plus the voice emotion backend in [`../backend`](../backend)
for the Voice Companion check-in.


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Start the backend (see [`../README.md`](../README.md)), or run `../start.sh` to start both
4. Run the app:
   `npm run dev`

The dev server proxies `/health`, `/predict` and `/ws` to the backend at
`BACKEND_URL` (default `http://127.0.0.1:8000`). See `.env.example` for
`VITE_API_URL`, which is used when the built app talks to a separately
hosted backend.
