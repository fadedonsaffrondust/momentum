import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.ts';
import { authPlugin } from './plugins/auth.ts';
import { errorHandlerPlugin } from './plugins/error-handler.ts';
import { authRoutes } from './routes/auth.ts';
import { usersRoutes } from './routes/users.ts';
import { settingsRoutes } from './routes/settings.ts';
import { rolesRoutes } from './routes/roles.ts';
import { tasksRoutes } from './routes/tasks.ts';
import { parkingsRoutes } from './routes/parkings.ts';
import { brandsRoutes } from './routes/brands.ts';
import { brandStakeholdersRoutes } from './routes/brand-stakeholders.ts';
import { brandMeetingsRoutes } from './routes/brand-meetings.ts';
import { brandActionItemsRoutes } from './routes/brand-action-items.ts';
import { brandImportRoutes } from './routes/brand-import.ts';
import { brandFeatureRequestsRoutes } from './routes/brand-feature-requests.ts';
import { brandFeatureRequestSyncRoutes } from './routes/brand-feature-request-sync.ts';
import { brandSyncRoutes } from './routes/brand-sync.ts';
import { brandEventsRoutes } from './routes/brand-events.ts';
import { inboxRoutes } from './routes/inbox.ts';
import { dailyLogsRoutes } from './routes/daily-logs.ts';
import { statsRoutes } from './routes/stats.ts';
import { dataRoutes } from './routes/data.ts';
import { taskAttachmentsRoutes } from './routes/task-attachments.ts';
import { jarvisRoutes } from './jarvis/api/routes.ts';

async function main() {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === 'production' ? 'info' : 'debug',
      transport:
        env.NODE_ENV === 'production'
          ? undefined
          : { target: 'pino-pretty', options: { colorize: true } },
    },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(errorHandlerPlugin);
  await app.register(helmet, {
    // SPA serves its own CSP via Vite; CSP at the API level would block
    // legitimate cross-origin XHR responses without adding meaningful
    // protection (the API only returns JSON, never HTML).
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  await app.register(rateLimit, {
    // Generous default keyed by IP; per-route configs tighten it for the
    // expensive endpoints (auth, export). 429 default response shape ships
    // with `Retry-After` — clients see a transient error toast.
    max: 300,
    timeWindow: '1 minute',
  });
  await app.register(multipart, {
    // 10 MB per file. The task-attachments route enforces the same cap on
    // the client; this is the server-side backstop. @fastify/multipart
    // raises an error with statusCode 413 when the limit trips, which the
    // error handler propagates verbatim.
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true as const }));

  await app.register(authRoutes);
  await app.register(usersRoutes);
  await app.register(settingsRoutes);
  await app.register(rolesRoutes);
  await app.register(tasksRoutes);
  await app.register(taskAttachmentsRoutes);
  await app.register(parkingsRoutes);
  await app.register(brandImportRoutes);
  await app.register(brandsRoutes);
  await app.register(brandStakeholdersRoutes);
  await app.register(brandMeetingsRoutes);
  await app.register(brandActionItemsRoutes);
  await app.register(brandFeatureRequestsRoutes);
  await app.register(brandFeatureRequestSyncRoutes);
  await app.register(brandSyncRoutes);
  await app.register(brandEventsRoutes);
  await app.register(inboxRoutes);
  await app.register(dailyLogsRoutes);
  await app.register(statsRoutes);
  await app.register(dataRoutes);
  await app.register(jarvisRoutes);

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
