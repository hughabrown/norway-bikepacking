# FjordPilot Operations

## Local Development

Install dependencies:

```bash
npm install
```

Regenerate Worker-readable trip data after itinerary data changes:

```bash
python3 build_tripdata.py
npm run fjordpilot:export-data
```

Run tests:

```bash
npm test
npm run typecheck
```

Run the static site:

```bash
python3 -m http.server 8080
```

Run the Worker locally:

```bash
npm run worker:dev
```

## Cloudflare Setup

Create the D1 database:

```bash
npx wrangler d1 create fjordpilot
```

Copy the returned `database_id` into `wrangler.toml` under the existing `fjordpilot` D1 binding.

Apply the migration:

```bash
npx wrangler d1 migrations apply fjordpilot --remote
```

Set secrets:

```bash
npx wrangler secret put FJORDPILOT_TOOL_TOKEN
npx wrangler secret put FJORDPILOT_WRITE_GATE
```

Deploy:

```bash
npm run worker:deploy
```

Record the HTTPS Worker URL printed by Wrangler. Use that URL as the base URL for ElevenLabs webhook tools.

Current production Worker URL:

```text
https://fjordpilot-api.hughbrown.workers.dev
```

## ElevenLabs Dashboard

1. Open agent `agent_2701kvfdp91hew6vyh90mbx3ha39`.
2. Paste `elevenlabs/fjordpilot-agent-prompt.md` into the agent prompt.
3. Add webhook tools from `elevenlabs/tool-schemas.md`.
4. Add the `Authorization` header with the same token stored as `FJORDPILOT_TOOL_TOKEN`.
5. Run every scenario in `elevenlabs/scenario-tests.md`.

The agent and tool configuration is also managed as code:

```bash
elevenlabs agents pull --agent agent_2701kvfdp91hew6vyh90mbx3ha39 --update
elevenlabs tools pull --all --update
elevenlabs tools push
elevenlabs agents push --agent agent_2701kvfdp91hew6vyh90mbx3ha39
```

Tool webhooks use the ElevenLabs workspace secret `FJORDPILOT_TOOL_TOKEN` as the `Authorization` header value.

The ElevenLabs workspace post-call webhook cannot use the reserved `Authorization` header. It sends the same raw token with:

```text
X-FjordPilot-Tool-Token: <token>
```

Current post-call webhook:

```text
FjordPilot post-call log -> d9fed32e6dba4b55b0df43ad5efcca20
```

## Website Deploy

The static website is served by GitHub Pages:

```text
https://hughabrown.github.io/norway-bikepacking/
```

GitHub Pages deploys from the repository's `main` branch. Keep the existing `<elevenlabs-convai>` element in `index.html`.

Use the Worker URL directly for ElevenLabs webhook tools. A Cloudflare Pages project is not required for the V1 deployment.

## Rollback

If tool calls fail after deployment:

1. Disable the failing webhook tool in ElevenLabs.
2. Keep the embedded agent active for read-only website context.
3. Re-run `npm test` and `npm run typecheck`.
4. Re-deploy the last known good Worker with `npm run worker:deploy`.

## Data Inspection

Inspect stored trip notes:

```bash
npx wrangler d1 execute fjordpilot --remote --command "SELECT created_at, variant, day, location, category, note FROM trip_notes ORDER BY created_at DESC LIMIT 20"
```

Inspect queued deep itinerary analyses:

```bash
npx wrangler d1 execute fjordpilot --remote --command "SELECT created_at, status, variant, analysis_type, question FROM deep_trip_analysis_jobs ORDER BY created_at DESC LIMIT 20"
```
