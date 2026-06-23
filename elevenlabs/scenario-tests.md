# FjordPilot Scenario Tests

Run these in the ElevenLabs dashboard after deploying the Worker and configuring tools.

| # | User prompt | Expected behavior |
|---|---|---|
| 1 | Where can we go for lunch on day 4? | Calls `search_trip_places` with day 4, variant `besseggen`, category `eat`, need `lunch`; mentions Beitostolen/Vaset options and uncertainty around opening hours. |
| 2 | What is the plan for day 7? | Calls `lookup_itinerary_day` for day 7 and summarizes route, distance, ascent, overnight, highlights, and notes. |
| 3 | What is the last proper grocery before the remote section? | Uses itinerary/place context and recommends the reliable grocery with caveats. |
| 4 | Where should we stay if we bail early on day 4? | Calls day lookup and place search; mentions Beitostolen as the day-4 bailout noted in the source data. |
| 5 | What should we watch out for on day 4? | Calls day lookup; mentions the long day after the hike, Valdresflye/Slettefjell effort, and Beitostolen bailout. |
| 6 | Log that we decided to stop in Beitostolen if the weather is bad. | Reads back the note, asks for confirmation and write gate, then calls `save_trip_note`; reports failure honestly if rejected. |
| 7 | What changes if I mean the all-gravel variant? | Calls lookup/search with variant `gravel` or asks a short clarification if needed. |
| 8 | Where should we stop if we bail early today? | If `current_date` maps to an itinerary date, resolves the day and answers for that day. |
| 9 | Where should we stop if we bail early today? | If `current_date` is outside the itinerary, asks for the itinerary day or segment. |
| 10 | Can you give me the highlights of the next five days? | V2: acknowledges with "Let me think that through across the itinerary." and routes to deep analysis. V1: asks for a start day or uses the open day when provided. |
| 11 | Is there a better way of doing this trip? | V2: routes to deep analysis before answering. V1: offers to reason from available itinerary data and asks for constraints. |
| 12 | Update the itinerary to add a side quest near Flam. | V2: routes to itinerary-change planner, asks clarifying questions, reads back PRD, and queues only after approval and write gate. V1: explains that itinerary PR automation is not enabled. |
