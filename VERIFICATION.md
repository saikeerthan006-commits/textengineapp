# Verification results

Checked against the configured live NVIDIA endpoint and existing Supabase project.

| Check | Result |
| --- | --- |
| TexEngine reply with the new GPT OSS key | HTTP 200, correctly compared 9.8 and 9.11 |
| TexDEV code tool and download | HTTP 200, generated Python source |
| Word tool and download | HTTP 200, reopened as a Word document |
| Long Word request | 5,167 words, 9 explicit page breaks (at least 10 pages), completed and downloaded in 115 seconds; physical page rendering was not checked |
| PowerPoint tool and download | HTTP 200, valid Office package |
| Excel tool and download | HTTP 200, numeric cells and formula preserved |
| Web search tool | Called successfully; returned official Python documentation link |
| Reply before file card | Passed for generated files |
| Supabase authentication settings, chat schema, artifact bucket | HTTP 200 |
| Persistent generated code and metadata | Downloaded directly from Supabase storage |
| pnpm 10.34.3 frozen lockfile | Passed |
| TypeScript check and production Vite build | Passed |
| Python API, agent and tool compilation | Passed |
| Live incremental answer streaming | TexEngine first delta in 10.84s; TexDEV in 5.88s |
| File workflow response streaming | First answer delta in 28.18s, before the download card; Python/JavaScript downloads HTTP 200 |
| Vercel rewrite adapter | Health HTTP 200; nonexistent artifact HTTP 404 |
| Server keys absent from frontend build | Passed |

## Hosting status

Vercel configuration and `.env.vercel` import file are prepared. The Vercel CLI is logged out, so no hosted deployment was created or verified. Import the environment file into the Vercel project and redeploy; see README.md. Account sign-in and per-user chat history were not exercised with a real user's credentials; the Supabase endpoints and schema were checked.


## Faster NVIDIA responses

TexEngine now uses low reasoning effort at every response detail level and 1k/2k/4k output budgets for Low/Medium/High. A live High-mode check returned the first visible text in 5.28 seconds and answered correctly. Direct endpoint checks varied substantially during this session, so NVIDIA-side latency can still fluctuate.
