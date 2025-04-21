import { Test, TestingModule } from '@nestjs/testing';
import { BackupRestoreService } from './backup-restore.service';

describe('BackupRestoreService', () => {
  let service: BackupRestoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BackupRestoreService],
    }).compile();

    service = module.get<BackupRestoreService>(BackupRestoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
