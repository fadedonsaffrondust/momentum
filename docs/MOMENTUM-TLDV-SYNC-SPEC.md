# Momentum — tl;dv Meeting Sync Feature Spec

## Context for Claude Code

Add a tl;dv integration to Momentum's Brands section. This allows users to pull meeting recordings and transcripts from tl;dv and associate them with the correct brand — extracting discussion summaries and action items automatically.

**The core design challenge:** The user's tl;dv account contains meetings from MANY contexts — internal standups, investor calls, 1:1s, brand calls, etc. We must avoid auto-syncing the wrong meetings to the wrong brands. The matching system must be deliberate and user-controlled, not a naive keyword match.

---

## tl;dv API Reference (Verified)

**Base URL:** `https://pasta.tldv.io/v1alpha1`
**Auth:** `x-api-key` header (NOT Bearer token)
**API version:** v1alpha1 (alpha — may change)

### Endpoints We Use

**1. List Meetings**

```
GET /meetings
Query params:
  - query: string (text search)
  - page: number
  - limit: number (default 50)
  - from: ISO datetime string
  - to: ISO datetime string
  - onlyParticipated: boolean
  - meetingType: "internal" | "external"
Response: { page, pages, total, pageSize, results: Meeting[] }
```

**2. Get Meeting**

```
GET /meetings/{meetingId}
Response: Meeting
```

**3. Get Transcript**

```
GET /meetings/{meetingId}/transcript
Response: { id, meetingId, data: Sentence[] }
  where Sentence = { speaker, text, startTime, endTime }
```

**4. Get Highlights**

```
GET /meetings/{meetingId}/highlights
Response: { meetingId, data: Highlight[] }
  where Highlight = { text, startTime, source: "manual"|"auto", topic: { title, summary } }
```

**Meeting shape:**

```typescript
{
  id: string,
  name: string,           // calendar event title
  happenedAt: string,     // ISO datetime
  url: string,            // tl;dv playback URL
  organizer: { name, email },
  invitees: [{ name, email }],
  template: { id, label }
}
```

**Retry behavior:** Use exponential backoff — max 3 retries, 1s initial delay, 2s max. Retry on 5xx and 429.

---

## Architecture: The Three-Layer Matching System

The central design principle is: **never sync a meeting to a brand automatically. Always show the user what's about to happen and let them confirm.**

The system has three layers:

### Layer 1: Brand Matching Rules (User-Configured)

Each brand gets a set of **matching rules** that define how to find its meetings in tl;dv. These are configured once per brand and refined over time.

**Rule types:**

1. **Stakeholder email match** — "Any meeting where one of this brand's stakeholders is an invitee or organizer." This is the strongest signal. If Danna (danna@boudinbakery.com) is on the call, it's almost certainly a Boudin meeting.

2. **Title keyword match** — "Meeting title contains any of these keywords." E.g., ["Boudin", "BNDN"]. Useful but weaker — generic titles like "Weekly" won't match, which is the right behavior.

3. **Meeting type filter** — "Only external meetings" or "Only internal" or "Both." For brand calls, "external" is almost always correct and eliminates all internal standups/syncs.

These rules are combined with AND logic by default: a meeting must match ALL active rules to be surfaced. The user can toggle each rule on/off per brand.

**Where this lives in UI:** Inside the Brand Detail View, add a "tl;dv Sync" settings panel (accessible via a gear icon next to the sync button, or inside the brand's "⋯" menu). This panel shows the active rules and lets the user edit them.

### Layer 2: Candidate Fetch + Scoring

When the user triggers a sync (manual, not automatic), Momentum:

1. Calls the tl;dv API with the broadest useful filter:
   - `meetingType` = whatever the rule specifies (default: "external")
   - `from` = date of last synced meeting for this brand (or 30 days ago if first sync)
   - `to` = now
   - `limit` = 50

2. For each returned meeting, computes a **match score** based on the brand's rules:
   - Stakeholder email found in invitees/organizer: **+50 points per match**
   - Title keyword found in meeting name: **+30 points per match**
   - Meeting type matches filter: **+10 points**
   - Meeting already synced to this brand (duplicate): **-1000 points** (effectively excluded)

3. Sorts candidates by score (descending) and splits into two buckets:
   - **High confidence** (score >= 50): shown with a green indicator, pre-checked for import
   - **Low confidence** (score 10-49): shown with an amber indicator, unchecked by default
   - **No match** (score < 10): hidden entirely

### Layer 3: User Review + Confirm (The Sync Review Modal)

This is the critical UX step. The user sees a **Sync Review Modal** showing all candidates:

**Layout:**

- Header: "Sync tl;dv meetings for [Brand Name]"
- Subheader: "Found X meetings since [last sync date]"
- Two sections:
  - **"Likely matches" (green)** — pre-checked, high confidence
  - **"Possible matches" (amber)** — unchecked, user can review and check

**Each candidate row shows:**

- Checkbox (checked/unchecked based on confidence)
- Meeting name
- Date
- Attendees (as name pills)
- Match reason (e.g., "Danna (stakeholder) was on this call" or "Title contains 'Boudin'")
- Confidence pill (green/amber)

**Actions:**

- "Sync Selected" — imports the checked meetings
- "Skip All" — closes without syncing
- Individual rows can be checked/unchecked

**After confirming:**
For each selected meeting, Momentum:

1. Fetches the transcript via `GET /meetings/{id}/transcript`
2. Fetches the highlights via `GET /meetings/{id}/highlights`
3. Sends transcript + highlights to OpenAI to extract:
   - A 2-3 sentence meeting summary
   - Action items
   - Key decisions
   - Attendee identification (map speakers to stakeholder names)
4. Creates a Meeting Note in Momentum's data model, linked to the brand
5. Creates Action Items, linked to the meeting
6. Stores the tl;dv meeting ID to prevent re-syncing (deduplication)

---

## OpenAI Processing (Post-Sync Extraction)

After fetching transcript + highlights from tl;dv, we send them to OpenAI to extract structured data for Momentum.

### System Prompt for Meeting Extraction

```
You are a structured data extractor for a product called Momentum. You will receive a meeting transcript and AI-generated highlights from tl;dv.

Your job is to extract:
1. A concise 2-3 sentence summary of the overall discussion
2. Action items — things someone committed to doing, or that were assigned
3. Key decisions — conclusions or agreements reached
4. Attendee mapping — identify who spoke and match to provided stakeholder names when possible

Context about this brand will be provided so you can make better extractions.

Rules:
- For the summary: be factual. Capture what was discussed, not filler. A busy executive reading this should know in 10 seconds what happened.
- For action items: preserve original phrasing. Include who owns the item if mentioned. Only extract real commitments, not discussion points.
- For decisions: only include explicit decisions or conclusions, not suggestions or open questions.
- For attendees: map speaker labels from the transcript to real names using the invitee list and stakeholder list provided. If you can't map a speaker, use the speaker label as-is.
- Return ONLY valid JSON. No markdown, no explanations.
```

### JSON Schema for OpenAI Response

```json
{
  "summary": "string — 2-3 sentence overall discussion summary",
  "actionItems": [
    {
      "text": "string — the action item",
      "owner": "string — person responsible, or 'unassigned'"
    }
  ],
  "decisions": ["string"],
  "attendees": [
    {
      "speakerLabel": "string — from transcript",
      "resolvedName": "string — matched stakeholder or best guess",
      "email": "string — if available from invitees, otherwise empty"
    }
  ]
}
```

### What Goes to OpenAI

Compose the user message as:

```
Brand: [brand name]
Known stakeholders: [list of stakeholder names and roles from the brand]
Meeting invitees from tl;dv: [list of invitee names and emails]

## Transcript
[Full transcript — speaker: text format, concatenated from Sentence[]]

## AI Highlights from tl;dv
[Highlights — topic title + summary + text, concatenated]
```

**Token management:** Transcripts can be long. If the transcript exceeds 80,000 characters (~20k tokens), truncate from the middle — keep the first 30 minutes and last 15 minutes of content. Meeting openings (agenda setting) and closings (action items, next steps) are the highest-value segments.

---

## UI Integration Points

### 1. Brand Detail — Sync Button

Add a **"Sync Recordings"** button in the Brand Detail header, next to "+ New Meeting Note."

- Icon: a refresh/sync icon
- If meeting recording integration is not configured (no API key), the button shows a tooltip: "Connect your meeting recorder in Settings to enable sync"
- If configured: clicking opens the Sync Review Modal
- While syncing: button shows a subtle spinner and "Syncing..."
- After sync: toast notification: "Synced 3 meeting recordings"

**IMPORTANT — No vendor branding in the UI.** Do NOT display "tl;dv" anywhere in the user interface. Use generic terms: "meeting recording", "recording", "meeting recorder", "sync recordings". The integration is tl;dv under the hood, but the UI should be vendor-agnostic. This applies everywhere — buttons, labels, tooltips, toast messages, settings, badges.

### 2. Brand Detail — Sync Settings (Gear Icon)

A small gear icon next to the sync button opens the Brand's recording matching rules:

- **Stakeholder emails to match:** Auto-populated from the brand's stakeholder list. User can add/remove. Shows which stakeholders have emails vs. just names (emails required for matching).
- **Title keywords:** Text input, comma-separated. E.g., "Boudin, BNDN, Bakery"
- **Meeting type filter:** Dropdown — "External only" (default), "Internal only", "Both"
- **Sync window:** How far back to look — "Last 7 days", "Last 14 days", "Last 30 days", "Last 90 days", "Custom"
- Save button — saves to the brand's data in localStorage

### 3. Meeting Notes — Recording Link

Meeting notes that have an associated recording should show a **"Recording" link** (small play icon + the word "Recording") that opens the video playback in a new tab. This link uses the `recordingUrl` field from the meeting note.

- Style: subtle, inline — a small play triangle icon (▶) followed by "Recording" as a clickable link, positioned near the meeting date/title
- The link opens in a new browser tab
- Only show this link on notes that actually have a `recordingUrl` — do not show it on manually created notes without recordings
- Do NOT show a vendor badge or logo. Just a clean "Recording" link.

### 4. Global Settings — Meeting Recorder Connection

In the command palette (Cmd/Ctrl + K → "Settings" or "Connect Meeting Recorder"):

- **API Key input:** Label reads "Meeting Recorder API Key". Masked, stored in localStorage
- **Connection test button:** Calls `GET /health` to verify the key works. Shows green checkmark or red X with error message.
- **Default meeting type filter:** Sets the default for new brands (can be overridden per-brand)
- A small help text: "Connects to your meeting recording service to sync transcripts and recordings."

---

## Data Model Additions

### Brand — New Fields

```javascript
{
  // ...existing brand fields...
  tldvSync: {
    enabled: boolean,
    lastSyncedAt: "iso" | null,
    lastSyncedMeetingDate: "iso" | null, // used as 'from' for next sync
    matchRules: {
      stakeholderEmails: ["email@domain.com"], // auto-populated from stakeholders
      titleKeywords: ["Boudin", "BNDN"],
      meetingType: "external" | "internal" | "both",
      syncWindowDays: 30
    },
    syncedMeetingIds: ["tldv-meeting-id-1", "tldv-meeting-id-2"] // deduplication
  }
}
```

### Meeting Note — New Fields

```javascript
{
  // ...existing meeting note fields...
  source: "manual" | "recording_sync" | "merged", // "merged" = had manual notes + recording synced in
  recordings: [                        // array to support multiple recordings per note (same day)
    {
      externalMeetingId: "string",     // tl;dv meeting ID — for deduplication, never shown in UI
      title: "string",                 // meeting title from recording (used as link label)
      url: "string",                   // playback URL — powers the "▶ Recording" link in UI
      transcriptRaw: "string"          // preserved raw transcript for re-processing
    }
  ]  // empty array for manual-only notes
}
```

### Settings — New Fields

```javascript
{
  // ...existing settings...
  meetingRecorder: {
    provider: "tldv",                  // hardcoded for now, supports future providers
    apiKey: "string" | null,           // stored obfuscated in display
    connected: boolean,                // set after successful health check
    defaultMeetingType: "external"     // default for new brands
  }
}
```

---

## Sync Flow — Complete Sequence

1. User opens a brand → clicks "Sync Recordings"
2. Momentum checks: is meeting recorder API key configured? If not → redirect to settings
3. Momentum reads the brand's matching rules
4. Momentum calls `GET /meetings` with filters from rules:
   - `meetingType` from rules
   - `from` = `lastSyncedMeetingDate` or (now - syncWindowDays)
   - `to` = now
   - Paginate if needed (loop through pages until all fetched)
5. For each meeting, compute match score against the brand's rules
6. Open the Sync Review Modal with scored candidates
7. User reviews, checks/unchecks, confirms
8. For each confirmed meeting (sequentially, to respect rate limits):
   a. `GET /meetings/{id}/transcript` → get transcript
   b. `GET /meetings/{id}/highlights` → get highlights
   c. Send transcript + highlights + brand context to OpenAI → get structured extraction
   d. **Merge-or-Create Meeting Note:**
   - Check if a Meeting Note already exists for this brand on the same date (`meeting.happenedAt` date matches an existing note's `date`)
   - **If a note exists for that day:** MERGE into it — append the new content below the existing `rawNotes` with a separator line (`---`) and a subheading showing the synced meeting's title (e.g., `### One on One with Danna (from recording)`). Merge action items and decisions into the existing note's lists (deduplicate by text similarity). Add the recording URL to the existing note. Update the summary by combining both. Add the new attendees to the existing attendee list (deduplicate by name).
   - **If no note exists for that day:** CREATE a new Meeting Note as normal.
   - This is critical because the user often takes manual notes before or during a call, then syncs the recording afterward. The result should be one unified note per day, not duplicates.
     e. Create Action Items from extraction
     f. Add synced meeting ID to brand's `syncedMeetingIds`
     g. Update progress indicator: "Processing 2 of 5..."
9. Update `lastSyncedAt` and `lastSyncedMeetingDate` on the brand
10. Close modal → show toast → refresh brand detail view

---

## Edge Cases and Error Handling

**API key invalid or expired:**

- The health check catches this on configuration
- If a sync call returns 401: show "Your meeting recorder API key is invalid or expired. Update it in Settings."
- Do NOT retry on 401

**Transcript not yet available:**

- tl;dv returns empty transcript if processing isn't done
- If transcript data array is empty: create the Meeting Note anyway with summary = "Transcript still processing — re-sync later to extract content" and flag it with a "pending" badge
- Show a toast: "1 meeting is still processing. Re-sync later to get the transcript."

**Rate limiting (429):**

- Use exponential backoff: 1s, 2s, 4s, max 3 retries
- If still rate limited after retries: pause sync, show message: "Rate limit reached. X of Y meetings synced. Try again in a few minutes for the rest."
- Save partial progress — don't rollback successfully synced meetings

**OpenAI API error during extraction:**

- If OpenAI fails: still create the Meeting Note with the raw transcript and highlights text, but skip structured extraction
- Mark the meeting note with a "needs processing" flag
- Allow manual re-processing later (button: "Re-extract with AI")

**No matching meetings found:**

- Show a friendly empty state in the Sync Review Modal: "No new meetings found matching your rules for [Brand Name]."
- Suggest: "Try adjusting your matching rules or sync window."

**Duplicate prevention:**

- Check `syncedMeetingIds` array on the brand before showing candidates
- Meetings already synced get score = -1000 and are hidden
- This works even if the same meeting would match multiple brands (each brand has its own synced IDs list)

**Very long transcripts (>80k characters):**

- Truncate for OpenAI: keep first 30 min + last 15 min of content (based on startTime)
- Store the full transcript in `tldvTranscriptRaw` regardless
- Note in the extraction prompt that the transcript was truncated

**Multiple recordings on the same day with an existing note:**

- If there are already manual notes for April 15 AND two recordings from April 15 are approved in the same sync, merge them sequentially: first recording merges into the existing note, second recording merges into the now-updated note. Each gets its own `---` separator and subheading. The note accumulates all recordings.
- The `recordingUrl` field becomes an array if multiple recordings exist for one note: `recordingUrls: [{ title, url }]`. The UI shows multiple "▶ Recording" links, each labeled with the meeting title to disambiguate (e.g., "▶ Weekly with Danna", "▶ Onboarding Follow-up").

**Brand has no stakeholder emails:**

- Stakeholder email matching won't work — warn the user: "Add email addresses to your stakeholders for better matching accuracy"
- Fall back to title keyword matching only

---

## Keyboard Shortcuts

| Key                | Context                             | Action                              |
| ------------------ | ----------------------------------- | ----------------------------------- |
| `s`                | Brand detail view                   | Open Sync Review Modal              |
| `Enter`            | Sync Review Modal, meeting selected | Toggle checkbox                     |
| `Cmd/Ctrl + Enter` | Sync Review Modal                   | Confirm and sync selected           |
| `Escape`           | Sync Review Modal                   | Close without syncing               |
| `j/k`              | Sync Review Modal                   | Navigate between meeting candidates |

---

## What "Done" Looks Like

1. User can connect their meeting recorder via API key in Settings (no vendor branding in UI)
2. User can configure matching rules per brand (stakeholder emails, keywords, meeting type)
3. User can trigger a sync from a brand's detail view via "Sync Recordings"
4. The Sync Review Modal shows scored candidates with match reasons — the user is always in control
5. Confirmed meetings are merged into existing same-day notes OR create new notes if none exist for that day
6. Synced meetings are processed via OpenAI to extract summaries, action items, and decisions
7. Meeting notes with recordings show a clean "▶ Recording" link that opens the playback in a new tab
8. Duplicate meetings are never re-synced
9. Partial failures are handled gracefully — no data loss, clear error messages

---

## What This Does NOT Do (Intentionally)

- **No automatic background sync.** Every sync is user-initiated. This is deliberate — we're prioritizing accuracy over convenience. Auto-sync can be a V2 feature once users trust the matching rules.
- **No cross-brand sync.** Each sync is per-brand. The user decides which brand to sync. A "sync all brands" bulk action can be V2.
- **No real-time webhooks.** tl;dv supports webhooks, but for V1 we use polling on demand. Webhooks add infrastructure complexity.
- **No meeting video playback inside Momentum.** We link to the recorder's player. Embedding video is out of scope.

---

## Future Iterations (Out of Scope for V1)

Reserve these for future work. Do not build yet, but keep them in mind when making architectural decisions.

- **Plan My Day sync prompt.** During the morning planning ritual, after reviewing yesterday's leftovers, add a step: "You have X unsynced recordings across your brands. Review now?" Opens a consolidated sync review across all brands — not per-brand. This removes the need to remember to sync manually and fits the existing daily ritual without adding a new habit.

- **Passive unsynced badge.** When the user opens the app or navigates to the Brands section, Momentum checks for new recordings matching any brand's rules in the background. If unsynced matches are found, show a subtle badge/count on the Brands nav item (like an unread count). The user deals with it when they're ready, but never misses it.

- **Sync All Brands.** A bulk action that runs the matching + review flow across all brands at once — one consolidated review modal with candidates grouped by brand.

- **Webhook-driven real-time sync.** tl;dv supports webhooks (e.g., MeetingReady event). A future version could listen for new recordings and trigger the matching pipeline automatically, surfacing matches as notifications rather than requiring manual sync.

- **Multi-provider support.** The `provider` field in settings is already set to `"tldv"`. Future iterations could add Fireflies, Otter, Grain, or other recording services behind the same vendor-agnostic UI.
