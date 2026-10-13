import { EventEmitter } from 'node:events';
import * as amqp from 'amqplib';
import { RabbitMQService } from './rabbitmq.service';

jest.mock('amqplib', () => ({ connect: jest.fn() }));

describe('RabbitMQ channel lifecycle and response acknowledgements', () => {
  let service: RabbitMQService;
  let connection: EventEmitter & { createChannel: jest.Mock; close: jest.Mock };
  let channel: Record<string, jest.Mock>;
  let receive: (message: any) => void;
  beforeEach(() => {
    jest.useFakeTimers();
    channel = Object.fromEntries(
      [
        'assertExchange',
        'assertQueue',
        'bindQueue',
        'consume',
        'publish',
        'ack',
        'close',
      ].map((name) => [name, jest.fn().mockResolvedValue(undefined)]),
    );
    channel.consume.mockImplementation(async (_queue, callback) => {
      receive = callback;
    });
    connection = Object.assign(new EventEmitter(), {
      createChannel: jest.fn().mockResolvedValue(channel),
      close: jest.fn().mockImplementation(async () => {
        connection.emit('close');
      }),
    });
    jest.mocked(amqp.connect).mockResolvedValue(connection as never);
    service = new RabbitMQService({
      get: () => 'true',
      getOrThrow: () => 'amqp://test-only',
    } as never);
  });
  afterEach(async () => {
    await service.close();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('[BE-RMQ-100] {RabbitMQService.connect} {RabbitMQService.setupResponseConsumer} {RabbitMQService.close} opens durable queues and intentional close cancels reconnection', async () => {
    await service.connect();
    expect(amqp.connect).toHaveBeenCalledWith('amqp://test-only');
    expect(channel.assertExchange).toHaveBeenCalledWith('ai_tasks', 'direct', {
      durable: true,
    });
    expect(channel.bindQueue).toHaveBeenCalledWith(
      'generate_description_queue',
      'ai_tasks',
      'generate_description',
    );
    await service.setupResponseConsumer();
    expect(channel.assertQueue).toHaveBeenCalledWith('nestjs_response_queue', {
      durable: true,
      arguments: { 'x-message-ttl': 300000 },
    });
    expect(channel.consume).toHaveBeenCalledWith(
      'nestjs_response_queue',
      expect.any(Function),
    );
    connection.emit('error', new Error('Connection dropped'));
    expect(jest.getTimerCount()).toBe(1);
    await service.close();
    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('[BE-RMQ-101] {RabbitMQService.setupResponseConsumer} a response without a request id is acknowledged exactly once', async () => {
    await service.connect();
    await service.setupResponseConsumer();
    const message = {
      content: Buffer.from(JSON.stringify({ description: 'Uncorrelated' })),
    };
    receive(message);
    expect(channel.ack).toHaveBeenCalledTimes(1);
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('[BE-RMQ-102] {RabbitMQService.setupResponseConsumer} malformed and unknown responses are each acknowledged once and null deliveries are ignored', async () => {
    await service.connect();
    await service.setupResponseConsumer();
    receive(null);
    expect(channel.ack).not.toHaveBeenCalled();
    const malformed = { content: Buffer.from('not json') };
    const unknown = {
      content: Buffer.from(
        JSON.stringify({ requestId: 'unknown', description: 'Unused' }),
      ),
    };
    receive(malformed);
    receive(unknown);
    expect(channel.ack.mock.calls).toEqual([[malformed], [unknown]]);
  });
});
