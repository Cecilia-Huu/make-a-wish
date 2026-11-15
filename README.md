# Make a Wish

**A little birthday magic, made with your hands.**

Make a Wish — A Gesture & Voice Birthday Experience is a React + TypeScript + Vite birthday ritual layered over a live mirrored camera. This repository continues the existing V2.3 implementation and includes no accounts or backend.

## Play

Desktop Chrome or Edge is the first testing target. Camera and microphone require **HTTPS or localhost** and are requested separately only after clicking their buttons. Permission denial leaves the mouse experience available: click word buttons, click the candle to light it, click again to extinguish, then Replay. On mobile, use portrait orientation and click controls if tracking is unavailable or slow.

| Interaction | Result |
| --- | --- |
| Physical left hand: thumb + index/middle/ring/little finger | I / love / you / so much |
| Physical right hand: thumb + index/middle/ring/little finger | Happy / Birthday / to / you |
| Release, then pinch again | Repeat any word freely |
| Point index finger near the wick for about 0.8 seconds | Light the candle |
| While lit, close mouth naturally, then hold an O shape for about 0.95 seconds | Simulate blowing out the candle |
| Both hands hold 🤟 for about 0.8 seconds | Full-screen floating pink hearts |
| Replay | Reset the ritual while keeping active device permissions |

O-mouth detection simulates blowing; it does not detect airflow. Microphone detection is optional. Both can produce false positives and need real-device calibration. Debug controls expose physical/raw hand labels, landmarks, mouth threshold/hold progress, microphone input, cake position and wick radius. If handedness is reversed for your camera, calibrate using only your physical right hand.

**Privacy:** video and microphone input are processed locally in the browser; the app does not upload or store them. Hosting providers receive normal requests for website files. Fonts are requested from Google Fonts with system fallbacks. Browser speech synthesis may use local or remote voices depending on the chosen voice and platform; the app submits only the displayed English word to it, not microphone audio.

## Local development

Use **Node.js 24** and npm. The lockfile is committed.

```bash
npm ci
npm run dev
```

Open `http://127.0.0.1:5181/`. Keep the terminal running; a localhost URL stops working when its development process stops. The dev server watches by polling to avoid stale source responses in this workspace.

```bash
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5182
```

The build checks bundled models, matching MediaPipe WASM, favicon and cover first. Production files are in `dist/`. There are no API keys or required environment variables.

## GitHub and Vercel

Repository: [Cecilia-Huu/make-a-wish](https://github.com/Cecilia-Huu/make-a-wish). Repository and website publication require owner confirmation. A private repository does not itself make a deployed website private.

1. In Vercel, import the GitHub repository into the intended account/team. Allow the Vercel GitHub App access to this repository if requested.
2. Select **Vite**, root directory `.` (repository root), install command `npm ci`, build command `npm run build`, output directory `dist`, Node.js `24.x`. These settings are also in `vercel.json` and `package.json`.
3. Keep deployment access protected until publication is approved. Check production protection before sharing with friends; authenticated preview URLs are not public links.
4. Vercel Git integration deploys updates to `main` automatically. Branch pushes create previews. Check the deployment dashboard for build state and exact commit rather than assuming a push succeeded.
5. The final domain is included automatically in canonical/Open Graph metadata using `VERCEL_PROJECT_PRODUCTION_URL`. For a custom domain, set `VITE_SITE_URL=https://your-domain.example` in Vercel and redeploy. The cover and favicon contain no real person's image.

Update from the local checkout:

```bash
git pull --ff-only
# Edit files, then verify:
npm run build
npm test
git add src public README.md package.json package-lock.json
# Include other intended configuration changes explicitly.
git commit -m "Describe the update"
git push origin main
```

Do not commit `.env`, access tokens, `node_modules`, caches or personal media. Ignore files exclude these. Vercel Git integration does not require adding a deployment token to the project.

**GitHub Pages alternative:** current resource URLs assume a root-domain deployment. A repository subpath such as `/make-a-wish/` needs a Vite `base`, matching `import.meta.env.BASE_URL` prefixes for model/WASM/favicon/cover URLs, and an Actions Pages build. Prefer Vercel for this version; Pages is not configured or tested.

## Code and assets

- `src/main.tsx`: lifecycle, UI and Canvas hearts; `src/gesture.ts`, `src/love.ts`, `src/mouth.ts`, `src/audio.ts`: existing gesture/audio state machines.
- `src/voice.ts`: all eight words use the selected browser voice/rate/pitch. `I` uses the homophone `eye` for pronunciation while displaying `I`. Optional matched MP3/WAV files can be added through `recordedWords`.
- `src/Cake.tsx`, `src/ThreeCake.tsx`: independent procedural 3D cake and projected wick hit target, with CSS fallback if WebGL is unavailable. This remains a placeholder geometry model; final photorealistic modeling/GLB assets are pending.
- `public/models/`: official MediaPipe gesture recognizer, face landmarker and fallback hand landmarker tasks. `public/wasm/`: matching locked runtime, served from the same website origin. No localhost paths are used for production model requests.
- `public/share-cover.png`: original generated brand cover without people; `public/favicon.svg`: vector cake icon. The cover is separate from the live cake renderer.

## Verification limits

`npm test` exercises eight pinch/release combinations, point dwell, love hold/rearm, neutral-to-O mouth timing, optional broadband microphone input and consistent voice settings. These are synthetic tests. Asset checks validate file integrity, not real hand or face detection.

Before sharing broadly, test a real HTTPS deployment on a laptop: allow/deny Camera and Mic separately, verify mirrored physical left/right mappings and repeated words, point-to-light, neutral-to-O extinguishing, 🤟 re-trigger, selected speech voice, click fallback, full-screen hearts, Replay and performance. Also open the site on a phone and check portrait layout. Browser-console, real hardware and deployed HTTPS tests must be reported separately from build success.
