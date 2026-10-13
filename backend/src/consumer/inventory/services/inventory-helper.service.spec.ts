import { HttpException } from '@nestjs/common';
import { InventoryHelperService } from './inventory-helper.service';

describe('InventoryHelperService', () => {
  const findFirst = jest.fn();
  const service = new InventoryHelperService({
    branch: { findFirst },
  } as never);
  beforeEach(() => findFirst.mockReset());

  it("[BE-INV-080] {InventoryHelperService.getWarehouseBranch} looks up only the tenant's warehouse branch", async () => {
    findFirst.mockResolvedValue({ id: 9, name: 'Warehouse' });
    await expect(service.getWarehouseBranch(5)).resolves.toEqual({
      id: 9,
      name: 'Warehouse',
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { consumer_id: 5, is_warehouse: true },
    });
  });

  it('[BE-INV-081] {InventoryHelperService.getWarehouseBranch} a database failure is a generic 500 without the cause', async () => {
    findFirst.mockRejectedValue(new Error('db exploded'));
    const error = await service.getWarehouseBranch(5).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe('Failed to find warehouse branch');
  });

  it.each([
    [{ id: 1, name: 'Main', is_warehouse: true }, true],
    [{ id: 2, name: 'Warehouse' }, true],
    [{ id: 3, name: 'Main', is_warehouse: false }, false],
    [{ id: 4, name: 'Branch' }, false],
  ])(
    '[BE-INV-082] {InventoryHelperService.isWarehouse} {InventoryHelperService.getLocationName} {InventoryHelperService.getLocationDescription} %j',
    (branch, warehouse) => {
      expect(service.isWarehouse(branch)).toBe(warehouse);
      expect(service.getLocationName(branch)).toBe(
        warehouse ? 'Warehouse' : branch.name,
      );
      expect(service.getLocationDescription(branch)).toBe(
        warehouse ? 'Central Warehouse' : `Branch: ${branch.name}`,
      );
    },
  );

  it('[BE-INV-083] {InventoryHelperService.generateAdjustmentBatchNumber} {InventoryHelperService.generateTransferBatchNumber} batch numbers carry their prefix and the last eight digits of the clock', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_791_900_123_456);
    expect(service.generateAdjustmentBatchNumber()).toBe('ADJ-00123456');
    expect(service.generateTransferBatchNumber()).toBe('TRF-00123456');
    jest.restoreAllMocks();
  });
});
