import { GenericContainer, StartedTestContainer, Wait } from 'testcontainers';
import { RabbitMQService } from '../../src/rabbitmq/rabbitmq.service';
import { resetDb, disconnect } from '../helpers/db';
import { createTestApp } from '../helpers/app';
import * as amqp from 'amqplib';

describe('RabbitMQ opt-in switch (slow)', () => {
  let rabbit: StartedTestContainer;
  let context: Awaited<ReturnType<typeof createTestApp>>;
  let observer: amqp.ChannelModel;
  let appClosed = false;
  beforeAll(async () => {
    rabbit = await new GenericContainer('rabbitmq:3.13-alpine')
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
      .start();
    process.env.RABBITMQ_ENABLED = 'true';
    process.env.RABBITMQ_URL = `amqp://guest:guest@${rabbit.getHost()}:${rabbit.getMappedPort(5672)}`;
    context = await createTestApp();
    observer = await amqp.connect(process.env.RABBITMQ_URL);
  });
  beforeEach(async () => {
    await resetDb();
  });
  afterAll(async () => {
    await observer?.close();
    if (!appClosed) await context?.app.close();
    await rabbit?.stop();
    await disconnect();
  });
  it('[BE-HARN-014] enabled service connects and publishes a message to the real queue', async () => {
    const channel = await observer.createChannel();
    try {
      let deliver: (message: amqp.ConsumeMessage) => void;
      const delivered = new Promise<amqp.ConsumeMessage>((resolve) => {
        deliver = resolve;
      });
      await channel.consume('generate_description_queue', (message) => {
        if (message) {
          channel.ack(message);
          deliver(message);
        }
      });
      await expect(
        context.moduleRef
          .get(RabbitMQService)
          .sendMessage('ai_tasks', 'generate_description', {
            product: 'Harness product',
            requestId: 'BE-HARN-014',
          }),
      ).resolves.toBe(true);
      const message = await delivered;
      expect(JSON.parse(message.content.toString())).toMatchObject({
        product: 'Harness product',
        requestId: 'BE-HARN-014',
      });
    } finally {
      await channel.close();
    }
    // Explicit shutdown must not schedule another connection after app.close().
    const timers = jest.spyOn(global, 'setTimeout');
    try {
      await context.app.close();
      appClosed = true;
      expect(
        timers.mock.calls.filter(([, delay]) => delay === 5000),
      ).toHaveLength(0);
    } finally {
      timers.mockRestore();
    }
  });
});
