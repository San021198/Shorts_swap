# Shorts Swap Studio — Netlify Mobile/PWA

This version is designed to run as a mobile web app on Netlify and be added to an Android/iPhone home screen.

## Architecture

- Static mobile-first frontend in `public/`
- Netlify Function in `netlify/functions/edit.mjs`
- OpenAI `gpt-image-2.5-sunburst` precision image edits
- One serverless API call per selected model
- Fixed model images + masks are sent from the browser to the function
- Custom model uses the browser-painted PNG mask
- Collage is created locally in the browser; it does not use an extra OpenAI image call
- OpenAI API key is server-side only
- PWA manifest + service worker included

OpenAI's current Image Edit API supports multiple input images, a mask, `gpt-image-2.5-sunburst`, PNG/JPEG/WebP inputs, and high/xhigh/max quality. The mask must be PNG, under 4 MB, with the same dimensions as the first image. See https://developers.openai.com/api/reference/resources/images/methods/edit

## Netlify deployment

1. Create a GitHub repository and upload this project.
2. In Netlify, choose **Add new project → Import an existing project** and select the repository.
3. Netlify will read `netlify.toml`.
4. In Netlify project settings, add an environment variable:
   - Key: `OPENAI_API_KEY`
   - Value: your OpenAI API key
5. Deploy.
6. Open the HTTPS Netlify URL on your phone.
7. Android Chrome: use the **Add to Home Screen / Install app** option. The app includes a manifest and service worker, so it can launch in standalone mode.
8. iPhone/iPad Safari: Share → Add to Home Screen.

## Local development

```bash
npm install
cp .env.example .env
# put your API key in .env
npm run dev
```

## Important

Do not put `OPENAI_API_KEY` in frontend JavaScript. The browser only calls `/api/edit`; the Netlify Function calls OpenAI.
