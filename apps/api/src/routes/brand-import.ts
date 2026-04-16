import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod';
import { eq } from 'drizzle-orm';
import { brandImportInputSchema, brandImportResponseSchema } from '@momentum/shared';
import { brands, brandStakeholders, brandMeetings, brandActionItems } from '@momentum/db';
import { db } from '../db.ts';
import { mapBrand } from '../mappers.ts';
import { env } from '../env.ts';

export const brandImportRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook('preHandler', app.authenticate);

  app.post(
    '/brands/import',
    {
      schema: {
        body: brandImportInputSchema,
        response: { 200: brandImportResponseSchema },
      },
    },
    async (req) => {
      const { fileName, fileContent } = req.body;

      const [stub] = await db
        .insert(brands)
        .values({
          userId: req.userId,
          name: fileName.replace(/\.(md|txt)$/i, ''),
          status: 'importing',
          importedFrom: 'file',
          rawImportContent: fileContent.slice(0, 100_000),
        })
        .returning();
      if (!stub) throw new Error('Failed to create brand stub');

      const stubBrand = mapBrand(stub);

      processImportAsync(stub.id, req.userId, fileContent, app.log).catch(() => {
        // Errors handled inside processImportAsync.
      });

      return { brand: stubBrand };
    },
  );
};

async function processImportAsync(
  brandId: string,
  userId: string,
  fileContent: string,
  logger: { error: (...args: unknown[]) => void; info: (...args: unknown[]) => void },
): Promise<void> {
  try {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) {
      await db
        .update(brands)
        .set({ status: 'import_failed', importError: 'OPENAI_API_KEY not configured on the server.' })
        .where(eq(brands.id, brandId));
      return;
    }

    const truncated = fileContent.length > 50_000 ? fileContent.slice(-50_000) : fileContent;

    const systemPrompt = `You are a structured data extractor for a product called Momentum. You will receive messy, human-written client notes (often exported from ClickUp, Notion, or similar tools) and must transform them into Momentum's clean opinionated schema.

Momentum separates client information into three layers:
1. North Star — goals, key stakeholders, success definition
2. Pulse — current open action items and activity
3. Archive — individual meeting notes with summaries, decisions, and action items

DO NOT preserve the source tool's structure. DO NOT include sections like "Agenda", "Features", "Notes", "Next steps" as separate fields — fold them appropriately into rawNotes or decisions or actionItems.

Extract and return JSON matching this exact schema. Only these fields. Nothing else.

Rules:
- If a field is not present in the source, return an empty string or empty array. Do not invent content.
- Deduplicate stakeholders by name (case-insensitive). Infer roles only if clearly stated.
- For each meeting, generate a 1-2 sentence summary from the notes. Be factual — no embellishment.
- Extract actionItems aggressively — look for: lines starting with →, dashes, "Action items:", "Next steps:", "To do:", or imperative phrasing ("Set up X", "Follow up with Y").
- decisions are only things explicitly framed as decisions or conclusions. Do not over-extract.
- Preserve original phrasing for action items and decisions — do not rephrase.
- Meeting dates: parse flexible formats (YYYY-MM-DD, "March 16", "3/16/2026") and normalize to YYYY-MM-DD.
- If a meeting date is ambiguous, use your best inference based on context/order in the document.

Return ONLY valid JSON. No markdown code blocks, no explanations.

JSON schema:
{
  "name": "string — brand name, extracted from H1 or first line",
  "goals": "string — may be empty",
  "successDefinition": "string — may be empty",
  "stakeholders": [
    { "name": "string", "role": "string (may be empty)", "notes": "string (may be empty)" }
  ],
  "meetings": [
    {
      "date": "YYYY-MM-DD",
      "title": "string",
      "attendees": ["string"],
      "summary": "1-2 sentence LLM-generated summary",
      "rawNotes": "string — cleaned but mostly preserved original notes",
      "decisions": ["string"],
      "actionItems": ["string"]
    }
  ]
}`;

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
          { role: 'system', content: systemPrompt },
          { role: 'user', content: truncated },
        ],
        temperature: 0.2,
        max_tokens: 16_384,
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

    const parsed = JSON.parse(rawContent) as {
      name: string;
      goals: string;
      successDefinition: string;
      stakeholders: { name: string; role: string; notes: string }[];
      meetings: {
        date: string;
        title: string;
        attendees: string[];
        summary: string;
        rawNotes: string;
        decisions: string[];
        actionItems: string[];
      }[];
    };

    await db
      .update(brands)
      .set({
        name: parsed.name || 'Imported Brand',
        goals: parsed.goals || null,
        successDefinition: parsed.successDefinition || null,
        updatedAt: new Date(),
      })
      .where(eq(brands.id, brandId));

    const seenNames = new Set<string>();
    for (const s of parsed.stakeholders ?? []) {
      const key = s.name.toLowerCase().trim();
      if (!key || seenNames.has(key)) continue;
      seenNames.add(key);
      await db.insert(brandStakeholders).values({
        brandId,
        userId,
        name: s.name.trim(),
        role: s.role?.trim() || null,
        notes: s.notes?.trim() || null,
      });
    }

    for (const m of parsed.meetings ?? []) {
      const [meeting] = await db
        .insert(brandMeetings)
        .values({
          brandId,
          userId,
          date: m.date || new Date().toISOString().slice(0, 10),
          title: m.title || 'Meeting',
          attendees: m.attendees ?? [],
          summary: m.summary || null,
          rawNotes: m.rawNotes || '',
          decisions: m.decisions ?? [],
        })
        .returning({ id: brandMeetings.id });

      if (meeting) {
        for (const ai of m.actionItems ?? []) {
          const text = ai.trim();
          if (!text) continue;
          await db.insert(brandActionItems).values({
            brandId,
            userId,
            meetingId: meeting.id,
            text,
          });
        }
      }
    }

    await db
      .update(brands)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(brands.id, brandId));

    logger.info({ brandId }, 'Brand import completed successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during import';
    logger.error({ brandId, err }, 'Brand import failed');
    await db
      .update(brands)
      .set({ status: 'import_failed', importError: message.slice(0, 2000) })
      .where(eq(brands.id, brandId));
  }
}
