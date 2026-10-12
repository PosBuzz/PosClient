import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { createTestApp } from '../helpers/app';
import { resetDb, disconnect } from '../helpers/db';
import { api } from '../helpers/http';

describe('Redis opt-in switch', () => {
  let redis: StartedTestContainer;
  let context: Awaited<ReturnType<typeof createTestApp>>;
  beforeAll(async () => {
    redis = await new GenericContainer('redis:7-alpine')
      .withExposedPorts(6379)
      .withWaitStrategy(Wait.forLogMessage('Ready to accept connections'))
      .start();
    process.env.REDIS_ENABLED = 'true';
    process.env.REDIS_HOST = redis.getHost();
    process.env.REDIS_PORT = String(redis.getMappedPort(6379));
    context = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await context?.app.close();
    await redis?.stop();
    await disconnect();
  });
  it('[BE-HARN-013] health writes and reads the real enabled Redis cache', async () => {
    const response = await api(context.app).anonymous().get('/health');
    expect(response.body).toMatchObject({
      status: 'ok',
      services: { redis: { status: 'healthy' } },
    });
  });
});
