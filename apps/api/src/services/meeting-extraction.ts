import type { TldvSentence, TldvHighlight } from './tldv.ts';

export interface ExtractionResult {
  summary: string;
  actionItems: { text: string; owner: string }[];
  decisions: string[];
  attendees: { speakerLabel: string; resolvedName: string; email: string }[];
}

export interface DeduplicationResult {
  toCreate: { text: string; owner: string | null }[];
  toUpdate: { existingId: string; text: string; owner: string | null }[];
  toSkip: string[];
}

const SYSTEM_PROMPT = `You are a structured data extractor for a product called Momentum. You will receive a meeting transcript and AI-generated highlights from tl;dv.

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

JSON schema:
{
  "summary": "string — 2-3 sentence overall discussion summary",
  "actionItems": [
    { "text": "string — the action item", "owner": "string — person responsible, or 'unassigned'" }
  ],
  "decisions": ["string"],
  "attendees": [
    { "speakerLabel": "string — from transcript", "resolvedName": "string — matched stakeholder or best guess", "email": "string — if available from invitees, otherwise empty" }
  ]
}`;

const MAX_TRANSCRIPT_CHARS = 80_000;

function formatTranscript(sentences: TldvSentence[]): string {
  if (sentences.length === 0) return '(No transcript available)';

  const full = sentences.map((s) => `${s.speaker}: ${s.text}`).join('\n');

  if (full.length <= MAX_TRANSCRIPT_CHARS) return full;

  // Truncate from the middle: keep first 30 min and last 15 min by startTime
  const maxTime = sentences[sentences.length - 1]!.startTime;
  const first30min = sentences.filter((s) => s.startTime <= 1800);
  const last15min = sentences.filter((s) => s.startTime >= maxTime - 900);

  const truncated = [
    ...first30min.map((s) => `${s.speaker}: ${s.text}`),
    '\n[... transcript truncated for length ...]\n',
    ...last15min.map((s) => `${s.speaker}: ${s.text}`),
  ].join('\n');

  return truncated.slice(0, MAX_TRANSCRIPT_CHARS);
}

function formatHighlights(highlights: TldvHighlight[]): string {
  if (highlights.length === 0) return '(No highlights available)';

  return highlights
    .map((h) => `[${h.topic.title}] ${h.text}`)
    .join('\n');
}

export function buildExtractionPrompt(
  brandName: string,
  stakeholders: { name: string; role: string | null }[],
  invitees: { name: string; email: string }[],
  transcript: TldvSentence[],
  highlights: TldvHighlight[],
): string {
  const stakeholderList =
    stakeholders.length > 0
      ? stakeholders.map((s) => `${s.name}${s.role ? ` (${s.role})` : ''}`).join(', ')
      : '(none configured)';

  const inviteeList =
    invitees.length > 0
      ? invitees.map((i) => `${i.name || '(unknown)'} <${i.email}>`).join(', ')
      : '(none)';

  return `Brand: ${brandName}
Known stakeholders: ${stakeholderList}
Meeting invitees from recording: ${inviteeList}

## Transcript
${formatTranscript(transcript)}

## AI Highlights
${formatHighlights(highlights)}`;
}

export async function extractMeetingContent(
  apiKey: string,
  brandName: string,
  stakeholders: { name: string; role: string | null }[],
  invitees: { name: string; email: string }[],
  transcript: TldvSentence[],
  highlights: TldvHighlight[],
): Promise<ExtractionResult> {
  const userMessage = buildExtractionPrompt(
    brandName,
    stakeholders,
    invitees,
    transcript,
    highlights,
  );

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const rawContent = json.choices[0]?.message.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(rawContent) as ExtractionResult;

  return {
    summary: parsed.summary || '',
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    attendees: Array.isArray(parsed.attendees) ? parsed.attendees : [],
  };
}

const DEDUP_SYSTEM_PROMPT = `You are a deduplication engine for action items. You will receive two lists:

1. EXTRACTED — action items just extracted from a new meeting recording
2. EXISTING — action items already stored for this brand

For each EXTRACTED item, determine one of:
- "create" — it is genuinely new, no match in EXISTING
- "skip" — it is essentially the same as an EXISTING item (same task, same meaning, even if worded differently)
- "update" — it is similar to an EXISTING item but contains meaningful new information (e.g., a more specific deadline, additional detail, changed owner). Provide the merged/improved text.

Rules:
- Two items are "the same" if they describe the same task for the same person, even with different wording.
- Only mark as "update" if the extracted item genuinely adds information the existing item lacks. Do not update just because wording differs slightly.
- When updating, produce a merged text that combines the best of both versions.
- Compare based on the action item text and owner. Ignore status.
- Return ONLY valid JSON. No markdown, no explanations.

JSON schema:
{
  "results": [
    {
      "extractedIndex": "number — index into the EXTRACTED list",
      "action": "create | skip | update",
      "existingId": "string or null — the id of the matched EXISTING item (required for skip/update, null for create)",
      "mergedText": "string or null — improved text (only for update)",
      "mergedOwner": "string or null — improved owner (only for update, null means unassigned)"
    }
  ]
}`;

const MAX_EXISTING_ITEMS = 100;

export function buildDeduplicationPrompt(
  extractedItems: { text: string; owner: string }[],
  existingItems: { id: string; text: string; owner: string | null }[],
): string {
  const extractedLines = extractedItems
    .map((item, i) => `${i}: [owner: ${item.owner}] ${item.text}`)
    .join('\n');

  const existingLines = existingItems
    .slice(0, MAX_EXISTING_ITEMS)
    .map((item) => `${item.id}: [owner: ${item.owner ?? 'unassigned'}] ${item.text}`)
    .join('\n');

  return `## EXTRACTED (from new meeting)\n${extractedLines}\n\n## EXISTING (already stored)\n${existingLines}`;
}

interface LLMDeduplicationResponse {
  results: Array<{
    extractedIndex: number;
    action: 'create' | 'skip' | 'update';
    existingId: string | null;
    mergedText: string | null;
    mergedOwner: string | null;
  }>;
}

export async function deduplicateActionItems(
  apiKey: string,
  extractedItems: { text: string; owner: string }[],
  existingItems: { id: string; text: string; owner: string | null }[],
): Promise<DeduplicationResult> {
  if (extractedItems.length === 0) {
    return { toCreate: [], toUpdate: [], toSkip: [] };
  }

  if (existingItems.length === 0) {
    return {
      toCreate: extractedItems.map((item) => ({
        text: item.text,
        owner: item.owner === 'unassigned' ? null : item.owner,
      })),
      toUpdate: [],
      toSkip: [],
    };
  }

  const existingIdSet = new Set(existingItems.map((item) => item.id));
  const userMessage = buildDeduplicationPrompt(extractedItems, existingItems);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: DEDUP_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${body.slice(0, 500)}`);
  }

  const json = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const rawContent = json.choices[0]?.message.content;
  if (!rawContent) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(rawContent) as LLMDeduplicationResponse;
  const results = Array.isArray(parsed.results) ? parsed.results : [];

  const toCreate: DeduplicationResult['toCreate'] = [];
  const toUpdate: DeduplicationResult['toUpdate'] = [];
  const toSkip: string[] = [];
  const seen = new Set<number>();

  for (const entry of results) {
    if (
      typeof entry.extractedIndex !== 'number' ||
      entry.extractedIndex < 0 ||
      entry.extractedIndex >= extractedItems.length ||
      seen.has(entry.extractedIndex)
    ) {
      continue;
    }
    seen.add(entry.extractedIndex);
    const extracted = extractedItems[entry.extractedIndex]!;

    if (entry.action === 'skip' && entry.existingId && existingIdSet.has(entry.existingId)) {
      toSkip.push(extracted.text);
    } else if (entry.action === 'update' && entry.existingId && existingIdSet.has(entry.existingId) && entry.mergedText) {
      toUpdate.push({
        existingId: entry.existingId,
        text: entry.mergedText,
        owner: entry.mergedOwner ?? null,
      });
    } else {
      toCreate.push({
        text: extracted.text,
        owner: extracted.owner === 'unassigned' ? null : extracted.owner,
      });
    }
  }

  for (let i = 0; i < extractedItems.length; i++) {
    if (!seen.has(i)) {
      const item = extractedItems[i]!;
      toCreate.push({
        text: item.text,
        owner: item.owner === 'unassigned' ? null : item.owner,
      });
    }
  }

  return { toCreate, toUpdate, toSkip };
}
