import { of, throwError } from 'rxjs';
import { DescriptionService } from './description.service';

describe('description service external boundaries', () => {
  const post = jest.fn();
  const sendMessage = jest.fn();
  const config = {
    fastApiUrl: 'http://ai.example.test',
    rabbitMQEnabled: false,
  };
  const service = new DescriptionService(
    { sendMessage } as never,
    { post } as never,
    config as never,
  );
  beforeEach(() => {
    post.mockReset();
    sendMessage.mockReset();
    config.rabbitMQEnabled = false;
  });

  it('[BE-AI-100] {DescriptionService.generateDescription} HTTP mode forwards the product, refresh flag and caller token', async () => {
    post.mockReturnValue(of({ data: { description: 'Fresh tea' } }));
    expect(
      await service.generateDescription(
        { product: 'Tea', force_refresh: true },
        'test-only-token',
      ),
    ).toBe('Fresh tea');
    expect(post).toHaveBeenCalledWith(
      'http://ai.example.test/generate-description',
      { product: 'Tea', force_refresh: true },
      { headers: { Authorization: 'Bearer test-only-token' } },
    );
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('[BE-AI-101] {DescriptionService.generateDescription} queue success returns the description and a queue outage falls back to HTTP', async () => {
    config.rabbitMQEnabled = true;
    sendMessage.mockResolvedValueOnce({ description: 'Queue tea' });
    expect(
      await service.generateDescription({ product: 'Tea' }, 'test-only-token'),
    ).toBe('Queue tea');
    expect(sendMessage).toHaveBeenCalledWith(
      'ai_tasks',
      'generate_description',
      expect.objectContaining({
        requestId: expect.any(String),
        product: 'Tea',
        jwt: 'test-only-token',
      }),
      true,
      60000,
    );
    expect(post).not.toHaveBeenCalled();
    sendMessage.mockRejectedValueOnce(new Error('Queue unavailable'));
    post.mockReturnValue(of({ data: { description: 'Fallback tea' } }));
    expect(
      await service.generateDescription({ product: 'Tea' }, 'test-only-token'),
    ).toBe('Fallback tea');
    expect(post).toHaveBeenCalledWith(
      'http://ai.example.test/generate-description',
      { product: 'Tea', force_refresh: false },
      { headers: { Authorization: 'Bearer test-only-token' } },
    );
  });

  it('[BE-AI-102] {DescriptionService.generateDescription} preserves a failed HTTP request for the controller to handle', async () => {
    const error = new Error('AI unavailable');
    post.mockReturnValue(throwError(() => error));
    await expect(
      service.generateDescription({ product: 'Tea' }, 'test-only-token'),
    ).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('[BE-AI-103] {DescriptionService.submitFeedback} forwards every feedback field and returns the service result', async () => {
    const dto = {
      product: 'Tea',
      description: 'Fresh tea',
      rating: 4,
      comment: 'Good',
      user_edited_description: 'My tea',
    };
    post
      .mockReturnValueOnce(of({ data: { success: true } }))
      .mockReturnValueOnce(of({ data: { success: false } }));
    expect(await service.submitFeedback(dto, 'test-only-token')).toBe(true);
    expect(await service.submitFeedback(dto, 'test-only-token')).toBe(false);
    expect(post).toHaveBeenCalledWith('http://ai.example.test/feedback', dto, {
      headers: { Authorization: 'Bearer test-only-token' },
    });
  });

  it('[BE-AI-104] {DescriptionService.submitFeedback} preserves the feedback transport failure', async () => {
    const error = new Error('Feedback unavailable');
    post.mockReturnValue(throwError(() => error));
    await expect(
      service.submitFeedback(
        { product: 'Tea', description: 'Tea', rating: 1 },
        'test-only-token',
      ),
    ).rejects.toBe(error);
    expect(post).toHaveBeenCalledTimes(1);
  });
});
