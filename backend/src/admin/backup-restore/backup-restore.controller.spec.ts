import { Test, TestingModule } from '@nestjs/testing';
import { BackupRestoreController } from './backup-restore.controller';
import { BackupRestoreService } from './backup-restore.service';

describe('BackupRestoreController', () => {
  let controller: BackupRestoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BackupRestoreController],
      providers: [BackupRestoreService],
    }).compile();

    controller = module.get<BackupRestoreController>(BackupRestoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
