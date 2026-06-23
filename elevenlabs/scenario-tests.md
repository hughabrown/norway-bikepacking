# FjordPilot Scenario Tests

Run these in the ElevenLabs dashboard after deploying the Worker and configuring tools.

| # | User prompt | Expected behavior |
|---|---|---|
| 1 | Where can we go for lunch on day 4? | Calls `search_trip_places` with day 4, variant `besseggen`, category `eat`, need `lunch`; mentions Beitostolen/Vaset options and uncertainty around opening hours. |
| 2 | What is the plan for day 7? | Calls `lookup_itinerary_day` for day 7 and summarizes route, distance, ascent, overnight, highlights, and notes. |
| 3 | What is the last proper grocery before the remote section? | Uses itinerary/place context and recommends the reliable grocery with caveats. |
| 4 | Where should we stay if we bail early on day 4? | Calls day lookup and place search; mentions Beitostolen as the day-4 bailout noted in the source data. |
| 5 | What should we watch out for on day 4? | Calls day lookup; mentions the long day after the hike, Valdresflye/Slettefjell effort, and Beitostolen bailout. |
| 6 | Log that we decided to stop in Beitostolen if the weather is bad. | Reads back the note, asks for confirmation and save code, then calls `save_trip_note`; explains naturally if saving is not allowed. |
| 7 | What changes if I mean the all-gravel variant? | Calls lookup/search with variant `gravel` or asks a short clarification if needed. |
| 8 | Where should we stop if we bail early today? | If `current_date` maps to an itinerary date, resolves the day and answers for that day. |
| 9 | Where should we stop if we bail early today? | If `current_date` is outside the itinerary, asks for the itinerary day or segment. |
| 10 | Can you give me the highlights of the next five days? | Acknowledges naturally, optionally using "Let me think that through across the itinerary", asks for a start day if needed, starts deeper analysis, and does not invent the final answer. |
| 11 | Is there a better way of doing this trip? | Uses the deep route-planning path, starts deeper analysis, speaks naturally, and does not expose internal references. |
| 12 | Update the itinerary to add a side quest near Flam. | V2: routes to itinerary-change planner, asks clarifying questions, reads back PRD, and proceeds only after approval and save code. V1: explains that automatic itinerary edits are not enabled. |
