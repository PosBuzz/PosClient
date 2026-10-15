import { NotFoundException } from '@nestjs/common';
import { expectGenericWrapping } from '../../../../test/helpers/error-wrapping';
import { CategoryService } from './category.service';

function setup() {
  const category = {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  return { category, service: new CategoryService({ category } as any) };
}

describe('CategoryService (unit)', () => {
  it('[BE-MUT-200] create stores the name for the calling consumer only', async () => {
    const { service, category } = setup();
    category.create.mockResolvedValue({ id: 5 });
    await expect(service.create({ name: 'Drinks' } as any, 9)).resolves.toEqual(
      { id: 5 },
    );
    expect(category.create).toHaveBeenCalledWith({
      data: { name: 'Drinks', consumer_id: 9 },
    });
  });

  it('[BE-MUT-201] findAll lists the consumer categories ordered by name', async () => {
    const { service, category } = setup();
    category.findMany.mockResolvedValue([{ id: 1 }]);
    await expect(service.findAll(9)).resolves.toEqual([{ id: 1 }]);
    expect(category.findMany).toHaveBeenCalledWith({
      where: { consumer_id: 9 },
      orderBy: { name: 'asc' },
    });
  });

  it('[BE-MUT-202] findOne is tenant scoped and a miss names the id in a 404', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValue({ id: 3 });
    await expect(service.findOne(3, 9)).resolves.toEqual({ id: 3 });
    expect(category.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 9 },
    });
    category.findFirst.mockResolvedValue(null);
    const error = await service.findOne(4, 9).catch((e) => e);
    expect(error).toBeInstanceOf(NotFoundException);
    expect(error.message).toBe('Category with ID 4 not found');
  });

  it('[BE-MUT-203] update checks ownership first, then renames only that row', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValue({ id: 3 });
    category.update.mockResolvedValue({ id: 3, name: 'New' });
    await expect(service.update(3, { name: 'New' } as any, 9)).resolves.toEqual(
      { id: 3, name: 'New' },
    );
    expect(category.findFirst).toHaveBeenCalledWith({
      where: { id: 3, consumer_id: 9 },
    });
    expect(category.update).toHaveBeenCalledWith({
      where: { id: 3 },
      data: { name: 'New' },
    });
    category.findFirst.mockResolvedValue(null);
    category.update.mockClear();
    await expect(
      service.update(3, { name: 'New' } as any, 9),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(category.update).not.toHaveBeenCalled();
  });

  it('[BE-MUT-204] remove checks ownership first and reports success', async () => {
    const { service, category } = setup();
    category.findFirst.mockResolvedValue({ id: 3 });
    category.delete.mockResolvedValue({});
    await expect(service.remove(3, 9)).resolves.toEqual({ success: true });
    expect(category.delete).toHaveBeenCalledWith({ where: { id: 3 } });
    category.findFirst.mockResolvedValue(null);
    category.delete.mockClear();
    await expect(service.remove(3, 9)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(category.delete).not.toHaveBeenCalled();
  });

  it('[BE-MUT-205] unexpected failures are logged with ids and hidden behind generic 500s; client errors pass through', async () => {
    await expectGenericWrapping({
      run: (f) => {
        const { service, category } = setup();
        category.create.mockRejectedValue(f);
        return service.create({ name: 'x' }, 9);
      },
      message: 'Failed to create category',
      logged: ['Failed to create category for consumer 9'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { service, category } = setup();
        category.findMany.mockRejectedValue(f);
        return service.findAll(9);
      },
      message: 'Failed to fetch categories',
      logged: ['Failed to fetch categories for consumer 9'],
    });
    await expectGenericWrapping({
      run: (f) => {
        const { service, category } = setup();
        category.findFirst.mockRejectedValue(f);
        return service.findOne(3, 9);
      },
      message: 'Failed to fetch category',
      logged: ['Failed to fetch category 3 for consumer 9'],
      notFoundPassesThrough: true,
    });
    await expectGenericWrapping({
      run: (f) => {
        const { service, category } = setup();
        category.findFirst.mockResolvedValue({ id: 3 });
        category.update.mockRejectedValue(f);
        return service.update(3, { name: 'x' }, 9);
      },
      message: 'Failed to update category',
      logged: ['Failed to update category 3 for consumer 9'],
      notFoundPassesThrough: true,
    });
    await expectGenericWrapping({
      run: (f) => {
        const { service, category } = setup();
        category.findFirst.mockResolvedValue({ id: 3 });
        category.delete.mockRejectedValue(f);
        return service.remove(3, 9);
      },
      message: 'Failed to delete category',
      logged: ['Failed to delete category 3 for consumer 9'],
      notFoundPassesThrough: true,
    });
  });
});
