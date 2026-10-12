import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { createTestApp } from '../helpers/app';
import { resetDb, disconnect } from '../helpers/db';
import { api } from '../helpers/http';
import { RabbitMQService } from '../../src/rabbitmq/rabbitmq.service';
import { DescriptionService } from '../../src/ai-services/services/description.service';

describe('Optional infrastructure disabled by default', () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(disconnect);
  it('[BE-HARN-011] real app boots with unreachable Redis and RabbitMQ', async () => {
    const { app } = await createTestApp();
    try {
      const response = await api(app).anonymous().get('/health');
      expect(response.body).toMatchObject({
        status: 'ok',
        services: {
          redis: { status: 'disabled' },
          database: { status: 'healthy' },
        },
      });
    } finally {
      await app.close();
    }
  });
  it('[BE-HARN-012] disabled queue rejects publishing and AI uses mocked HTTP directly', async () => {
    const post = jest
      .fn()
      .mockReturnValue(of({ data: { description: 'Mock description' } }));
    const { app, moduleRef } = await createTestApp({
      overrides: [[HttpService, { post }]],
    });
    try {
      const rabbit = moduleRef.get(RabbitMQService);
      await expect(
        rabbit.sendMessage('ai_tasks', 'generate_description', {}),
      ).rejects.toThrow('RabbitMQ is disabled');
      const publish = jest.spyOn(rabbit, 'sendMessage');
      await expect(
        moduleRef
          .get(DescriptionService)
          .generateDescription(
            { product: 'Test product', force_refresh: false },
            'test-jwt',
          ),
      ).resolves.toBe('Mock description');
      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith(
        'http://127.0.0.1:9/generate-description',
        { product: 'Test product', force_refresh: false },
        { headers: { Authorization: 'Bearer test-jwt' } },
      );
      expect(publish).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
