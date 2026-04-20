import type { AnyTool, Tool, ToolContext } from './types.ts';
import {
  TOOL_TIMEOUT_MS,
  ToolNotFoundError,
  ToolTimeoutError,
  ToolExecutionError,
} from './types.ts';
import { getMyTasks, getTasks, getTaskById } from './tasks.ts';
import { getTeamMembers, getMemberTasks } from './team.ts';
import { getBrand, getBrands, getBrandActionItems, getBrandMeetings } from './brands.ts';
import { getActionItems, getOverdueActionItems } from './action-items.ts';
import { getRecentMeetings, getMeeting } from './meetings.ts';
import { getBrandsRequiringAttention } from './analytical.ts';

/**
 * Registry of V1 Jarvis tools. Instances are isolated — the orchestrator
 * creates one at startup via `createDefaultRegistry()`, and tests build
 * their own so state never leaks across test files.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, AnyTool>();

  registerTool<I, O>(tool: Tool<I, O>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  getTool(name: string): AnyTool | undefined {
    return this.tools.get(name);
  }

  getAllTools(): AnyTool[] {
    return [...this.tools.values()];
  }

  /**
   * Execute a tool by name with a hard 5s timeout. Validates args against
   * the tool's Zod schema before handing off to the handler. Always throws
   * one of `ToolNotFoundError`, `ToolTimeoutError`, or `ToolExecutionError`
   * — never the raw handler error — so the orchestrator has a flat, known
   * error surface to translate into Anthropic `tool_result` blocks.
   */
  async executeTool(name: string, args: unknown, ctx: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new ToolNotFoundError(name);

    let parsedArgs: unknown;
    try {
      parsedArgs = tool.inputSchema.parse(args);
    } catch (err) {
      throw new ToolExecutionError(
        name,
        `invalid arguments: ${err instanceof Error ? err.message : String(err)}`,
        err,
      );
    }

    const startedAt = Date.now();
    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new ToolTimeoutError(name, TOOL_TIMEOUT_MS)),
        TOOL_TIMEOUT_MS,
      );
    });

    try {
      const result = await Promise.race([tool.handler(parsedArgs, ctx), timeoutPromise]);
      ctx.logger.info({ tool: name, latencyMs: Date.now() - startedAt }, 'jarvis tool executed');
      return result;
    } catch (err) {
      const latencyMs = Date.now() - startedAt;
      if (err instanceof ToolTimeoutError) {
        ctx.logger.error({ tool: name, latencyMs }, 'jarvis tool timed out');
        throw err;
      }
      if (err instanceof ToolExecutionError) {
        ctx.logger.error(
          { tool: name, latencyMs, cause: err.toolCause },
          'jarvis tool execution error',
        );
        throw err;
      }
      const message = err instanceof Error ? err.message : String(err);
      ctx.logger.error({ tool: name, latencyMs, err }, 'jarvis tool handler threw');
      throw new ToolExecutionError(name, message, err);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

/**
 * Construct the registry pre-populated with every V1 tool. Call sites
 * (the orchestrator) invoke this once at startup.
 */
export function createDefaultRegistry(): ToolRegistry {
  const registry = new ToolRegistry();
  // Task tools
  registry.registerTool(getMyTasks);
  registry.registerTool(getTasks);
  registry.registerTool(getTaskById);
  // Team tools
  registry.registerTool(getTeamMembers);
  registry.registerTool(getMemberTasks);
  // Brand tools
  registry.registerTool(getBrand);
  registry.registerTool(getBrands);
  registry.registerTool(getBrandActionItems);
  registry.registerTool(getBrandMeetings);
  // Action item tools
  registry.registerTool(getActionItems);
  registry.registerTool(getOverdueActionItems);
  // Meeting tools
  registry.registerTool(getRecentMeetings);
  registry.registerTool(getMeeting);
  // Analytical tools
  registry.registerTool(getBrandsRequiringAttention);
  return registry;
}

export * from './types.ts';
export { getMyTasks, getTasks, getTaskById } from './tasks.ts';
export { getTeamMembers, getMemberTasks } from './team.ts';
export { getBrand, getBrands, getBrandActionItems, getBrandMeetings } from './brands.ts';
export { getActionItems, getOverdueActionItems } from './action-items.ts';
export { getRecentMeetings, getMeeting } from './meetings.ts';
export { getBrandsRequiringAttention } from './analytical.ts';
