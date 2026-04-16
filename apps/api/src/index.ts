import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  type ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './env.ts';
import { authPlugin } from './plugins/auth.ts';
import { errorHandlerPlugin } from './plugins/error-handler.ts';
import { authRoutes } from './routes/auth.ts';
import { settingsRoutes } from './routes/settings.ts';
import { rolesRoutes } from './routes/roles.ts';
import { tasksRoutes } from './routes/tasks.ts';
import { parkingsRoutes } from './routes/parkings.ts';
import { dailyLogsRoutes } from './routes/daily-logs.ts';
import { statsRoutes } from './routes/stats.ts';
import { dataRoutes } from './routes/data.ts';

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
  await app.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await app.register(authPlugin);

  app.get('/health', async () => ({ ok: true as const }));

  await app.register(authRoutes);
  await app.register(settingsRoutes);
  await app.register(rolesRoutes);
  await app.register(tasksRoutes);
  await app.register(parkingsRoutes);
  await app.register(dailyLogsRoutes);
  await app.register(statsRoutes);
  await app.register(dataRoutes);

  try {
    await app.listen({ port: env.API_PORT, host: env.API_HOST });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
