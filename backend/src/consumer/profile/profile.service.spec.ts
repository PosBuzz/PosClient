import { BadRequestException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../test/helpers/error-wrapping';
import { ProfileService } from './profile.service';

const setup = () => {
  const consumer = { update: jest.fn() };
  return { consumer, service: new ProfileService({ consumer } as any) };
};

describe('ProfileService (unit)', () => {
  it('[BE-MUT-210] only the five allowed fields reach the update, and the returned columns are pinned', async () => {
    const { service, consumer } = setup();
    consumer.update.mockResolvedValue({ id: 4 });
    await expect(
      service.updateProfile(4, {
        secondary_email: 's@x.io',
        phone: '123',
        address: 'Road 1',
        company_name: 'Shop',
        logo: 'logo.png',
        email: 'attacker@x.io',
        plan_id: 99,
        id: 1,
      }),
    ).resolves.toEqual({ id: 4 });
    expect(consumer.update).toHaveBeenCalledWith({
      where: { id: 4 },
      data: {
        secondary_email: 's@x.io',
        phone: '123',
        address: 'Road 1',
        company_name: 'Shop',
        logo: 'logo.png',
      },
      select: {
        id: true,
        company_name: true,
        email: true,
        secondary_email: true,
        phone: true,
        address: true,
        logo: true,
      },
    });
  });

  it('[BE-MUT-211] a field sent as null or empty is written (clearing), only undefined is skipped', async () => {
    const { service, consumer } = setup();
    consumer.update.mockResolvedValue({});
    await service.updateProfile(4, {
      phone: null,
      address: '',
      logo: undefined,
    });
    expect(consumer.update.mock.calls[0][0].data).toEqual({
      phone: null,
      address: '',
    });
  });

  it('[BE-MUT-212] an update with no allowed field is a 400 with a readable message and touches nothing', async () => {
    const { service, consumer } = setup();
    const error = await service
      .updateProfile(4, { email: 'x@y.z', logo: undefined })
      .catch((e) => e);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.message).toBe('Provide at least one profile field to update.');
    expect(consumer.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-213] unexpected failures are logged with the consumer id and hidden behind a generic 500', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service, consumer } = setup();
        consumer.update.mockRejectedValue(f);
        return service.updateProfile(4, { phone: '1' });
      },
      message: 'Failed to update consumer profile',
      logged: ['Error updating consumer profile for ID 4'],
    });
  });
});
