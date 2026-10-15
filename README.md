# Vakyam Voice

Vakyam Voice Agents by Wayam: a single page where a signed-in client talks to a voice agent in the browser. The current agent is "Meera", a bilingual (Hindi/English) Club Mahindra member concierge, running on an Azure OpenAI realtime (speech-to-speech) model.

## How it works

1. The client signs in at `/login` (Supabase email/password).
2. On `/`, pressing the mic button calls the `realtime-token` Edge Function.
3. The function checks the caller is a signed-in user, then asks Azure for a short-lived session token with Meera's prompt and voice already bound to it.
4. The browser connects straight to Azure over WebRTC with that token and streams the member's audio to the model.
5. With Azure Speech configured, the model replies in text and the browser speaks each sentence with a native Indian voice (`src/lib/speechOutput.ts`) as it arrives. Without it, the model speaks with its own voice.

The Azure API key and the prompt never reach the browser. Calls are cut off after 10 minutes.

## Changing the agent

Meera's prompt and opening line live in `supabase/functions/realtime-token/prompt.ts`. Edit the file and redeploy the function. The voice is the `AZURE_REALTIME_VOICE` secret.

## Demo data

`supabase/functions/realtime-token/inventory.ts` gives Meera a **mock** member account and resort availability so she can discuss real dates, remaining nights and holds. None of it comes from a Club Mahindra system, and holds are not recorded anywhere. Availability is generated per calendar week, so the same date gives the same answer on every call. Replace `buildDemoContext` with real inventory and member lookups before using the agent with actual members.

## Client accounts

There is no signup page. Create client accounts in the Supabase dashboard under Authentication > Users, and turn off "Allow new users to sign up" so accounts cannot be created through the API.

## Local development

Requires Node.js 20+ and npm.

```sh
npm install
npm run dev      # http://localhost:8080
```

Other scripts: `npm run build`, `npm run preview`, `npm run lint`.

## Configuration

Front-end variables live in `.env` (see `.env.example`). These are publishable values:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Edge Function secrets are set with `supabase secrets set`, never in `.env`:

- `AZURE_OPENAI_RESOURCE`: Azure AI resource name (the part before `.openai.azure.com`)
- `AZURE_OPENAI_API_KEY`: that resource's API key
- `AZURE_REALTIME_DEPLOYMENT`: name of the realtime model deployment
- `AZURE_REALTIME_VOICE`: optional; defaults to `marin`
- `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION`: optional Azure Speech resource (currently `wayam-speech-centralindia`). When both are set, the realtime model replies in text and the browser speaks it with a native Indian Azure voice, so `AZURE_REALTIME_VOICE` is ignored.
- `AZURE_SPEECH_VOICE`: optional; defaults to `en-IN-AartiIndicNeural`, which speaks both Indian English and Hindi

### Testing the function locally

Put the secrets above, plus `SUPABASE_URL` and `SUPABASE_ANON_KEY`, in `supabase/.env.local`, and add `VITE_REALTIME_TOKEN_URL=http://localhost:8000` to `.env.local`. Both files are gitignored. Then run the function next to `npm run dev`:

```sh
npx deno run --no-lock --allow-net --allow-env --allow-read --env-file=supabase/.env.local supabase/functions/realtime-token/index.ts
```

## Deployment

- **Azure Static Web Apps**: every push to `main` builds and deploys through `.github/workflows/azure-static-web-app.yml`, using the `AZURE_STATIC_WEB_APPS_API_TOKEN` repository secret. `public/staticwebapp.config.json` rewrites all paths to `index.html`.
- **Vercel**: builds with `npm run build`; `vercel.json` rewrites all paths to `index.html`.
- **Docker**: run `npm run build`, then `docker build -t vakyam-voice .` to serve `dist/` with nginx on port 80.
- **Edge Function**: `npx supabase functions deploy realtime-token`.
