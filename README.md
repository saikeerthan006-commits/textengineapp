# TexEngine / TexDEV

React + Vite frontend with a Python Flask API. Both products use NVIDIA `openai/gpt-oss-20b`. Images are not accepted. TexEngine answers text questions; TexDEV also calls tools for code, Word, PowerPoint, Excel, workspace operations, and web search. Download cards appear with the agent response.

## Local development

- Install with `pnpm install --frozen-lockfile` and `python -m pip install -r requirements.txt`.
- Configure server credentials in `backend/.env` using `backend/.env.example` as a reference.
- Run `python backend/app.py` and `pnpm run dev` in separate terminals.
- Open http://localhost:8443. Vite forwards `/api` to Flask on port 5000.

## Vercel deployment

Deploy the **project root**, including `api/`, `backend/`, `requirements.txt`, `pnpm-lock.yaml`, and `vercel.json`. The configuration selects Vite, builds `dist`, and routes `/api/*` into the Python function. The frozen pnpm lockfile must remain committed alongside package.json.

Before deploying, open the Vercel project's Settings > Environment Variables and import the local `.env.vercel` file. Select Production and Preview, save, and redeploy. That file contains the configured server credentials and is excluded from uploads and source control. Do not upload it as a public asset.

Required server variables:

| Variable | Purpose |
| --- | --- |
| NVIDIA_TEXENGINE_API_KEY | NVIDIA key for TexEngine |
| NVIDIA_TEXDEV_API_KEY | NVIDIA key for TexDEV |
| NVIDIA_TEXENGINE_MODEL | `openai/gpt-oss-20b` |
| NVIDIA_TEXDEV_MODEL | `openai/gpt-oss-20b` |
| NVIDIA_TEXENGINE_BASE_URL | `https://integrate.api.nvidia.com/v1` |
| NVIDIA_TEXDEV_BASE_URL | `https://integrate.api.nvidia.com/v1` |
| SUPABASE_URL | Project URL |
| SUPABASE_SECRET_KEY | Server key for persistent artifact storage |
| SUPABASE_ARTIFACT_BUCKET | `texdev-artifacts` (private bucket) |

Public Supabase connection settings are included in `src/services/supabasePublicConfig.ts`; the browser can also override them using `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Provider keys and the Supabase secret must never use the VITE prefix.

In Supabase Authentication > URL Configuration, set the deployed HTTPS origin as Site URL and allow the relevant production/preview redirect URLs. The existing chat table schema and RLS policies are required for account chat history. Email confirmation follows the Supabase project's authentication settings.

Generated downloads are saved in the private Supabase bucket and fetched through the API, so they survive Vercel restarts. Workspace execution uses temporary storage on Vercel: local project edits are not persistent across function instances, and commands requiring tools absent from the Python runtime cannot execute there. Generated downloadable files are persistent.

Use Vercel Hobby with Fluid compute enabled. This app requests a 300-second function duration; especially large multi-step requests can still exceed the hosting limit. See [Vercel function limits](https://vercel.com/docs/functions/limitations). Provider and Supabase quotas also apply. No paid resources are provisioned by this project.

## Checks

- `pnpm install --frozen-lockfile`
- `pnpm exec tsc --noEmit`
- `pnpm run build`
- `/api/health` returns JSON on both local and hosted environments.
- Check chat answers, a TexDEV file download, sign-in, and chat history after deployment. Saving environment variables alone does not update an existing deployment; redeploy it.
