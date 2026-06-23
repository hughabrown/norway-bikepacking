# FjordPilot ElevenLabs Tool Schemas

Configure these as authenticated webhook tools in the ElevenLabs dashboard for agent `agent_2701kvfdp91hew6vyh90mbx3ha39`.

Use HTTP headers:

- `Authorization`: `Bearer ` followed by the exact secret string entered with `npx wrangler secret put FJORDPILOT_TOOL_TOKEN`.
- `Content-Type`: `application/json`.

The deployed base URL is the HTTPS URL printed by `npm run worker:deploy`.

## Post-Call Webhook

Configure the ElevenLabs post-call webhook to:

- Method: `POST`
- Path: `/api/fjordpilot/webhooks/post-call`
- Header: `X-FjordPilot-Tool-Token` with the raw `FJORDPILOT_TOOL_TOKEN` value

The Worker stores the full payload in D1 table `post_call_logs`. Use it for summaries, unresolved follow-ups, and analytics. Explicit "log this" requests still use the live `save_trip_note` tool during the conversation.

## `lookup_itinerary_day`

- Method: `POST`
- Path: `/api/fjordpilot/tools/lookup_itinerary_day`
- Description: Return authoritative itinerary day information.

Request schema:

```json
{
  "type": "object",
  "properties": {
    "day": { "type": "integer", "minimum": 0 },
    "variant": { "type": "string", "description": "Defaults to besseggen when omitted." }
  },
  "required": ["day"],
  "additionalProperties": false
}
```

## `search_trip_places`

- Method: `POST`
- Path: `/api/fjordpilot/tools/search_trip_places`
- Description: Mandatory before answering trip-specific questions about lunch, dinner, cafes, restaurants, groceries, resupply, lodging, campsites, hotels, bailouts, fallback stops, sights, or detours. Return ranked saved places for food, sleep, resupply, sights, and fallback planning.

Request schema:

```json
{
  "type": "object",
  "properties": {
    "day": { "type": "integer", "minimum": 0 },
    "variant": { "type": "string", "description": "Defaults to besseggen when omitted." },
    "near": { "type": "string" },
    "category": { "type": "string", "enum": ["eat", "sleep", "resupply", "sight"] },
    "need": { "type": "string" },
    "limit": { "type": "integer", "minimum": 1, "maximum": 12 }
  },
  "additionalProperties": false
}
```

## `save_trip_note`

- Method: `POST`
- Path: `/api/fjordpilot/tools/save_trip_note`
- Description: Save an explicitly confirmed trip note after validating the write gate.

Request schema:

```json
{
  "type": "object",
  "properties": {
    "day": { "type": "integer", "minimum": 0 },
    "variant": { "type": "string", "description": "Defaults to besseggen when omitted." },
    "location": { "type": "string" },
    "category": { "type": "string", "enum": ["decision", "mechanical", "food", "weather", "lodging", "follow_up"] },
    "note": { "type": "string" },
    "confirmed": { "type": "boolean" },
    "write_gate": { "type": "string" }
  },
  "required": ["category", "note", "confirmed", "write_gate"],
  "additionalProperties": false
}
```
