import { db } from '../db.ts';
import { env } from '../env.ts';
import { AnthropicProvider, type LLMProvider } from './llm-provider.ts';
import { JarvisService } from './orchestrator.ts';
import { createDefaultRegistry } from './tools/index.ts';

/**
 * Lazy module-level JarvisService. The Fastify route handler asks for it
 * per request; it's constructed once on first use and reused. This mirrors
 * the shape of `apps/api/src/db.ts` (module singleton) so route code stays
 * stateless.
 *
 * The LLM provider is the one thing in the service graph that can fail at
 * construction time (missing ANTHROPIC_API_KEY). By lazy-constructing we
 * let the rest of the API boot even if the key isn't set — only the
 * `/api/jarvis/conversations/:id/messages` endpoint then fails loudly
 * with a helpful 500 when someone actually tries to stream a turn. The
 * other four endpoints (list/get/create/delete) are pure DB and work
 * without the LLM.
 */
let serviceSingleton: JarvisService | null = null;

export function getJarvisService(): JarvisService {
  if (serviceSingleton) return serviceSingleton;

  if (!env.ANTHROPIC_API_KEY) {
    throw new Error(
      'Jarvis is not configured: set ANTHROPIC_API_KEY in the api environment to enable the /messages endpoint.',
    );
  }

  const llm: LLMProvider = new AnthropicProvider({ apiKey: env.ANTHROPIC_API_KEY });
  serviceSingleton = new JarvisService({
    llm,
    registry: createDefaultRegistry(),
    db,
  });
  return serviceSingleton;
}

/** Tests swap in a hand-built service so they don't hit the Anthropic SDK. */
export function _setJarvisServiceForTesting(service: JarvisService | null): void {
  serviceSingleton = service;
}
