import { HttpException } from '@nestjs/common';
import { exec } from 'child_process';
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs';
import * as os from 'os';
import { join } from 'path';
import { BackupRestoreService } from './backup-restore.service';

// pg_dump/psql are external boundaries; these tests never execute database commands.
jest.mock('child_process', () => ({ exec: jest.fn() }));
jest.mock('os', () => ({ ...jest.requireActual('os'), tmpdir: jest.fn() }));

describe('backup and restore process boundaries', () => {
  const config = {
    pgDumpPath: '/test/pg_dump',
    psqlPath: '/test/psql',
    dbHost: 'localhost',
    dbPort: '55432',
    dbUsername: 'test',
    dbPassword: 'test-only',
    dbName: 'posbuzz_test',
  };
  const service = new BackupRestoreService(config as never);
  let directory: string;
  beforeEach(() => {
    directory = mkdtempSync('/tmp/posbuzz-backup-unit-');
    jest.mocked(os.tmpdir).mockReturnValue(directory);
    jest.mocked(exec).mockReset();
    jest.spyOn(Date, 'now').mockReturnValue(1791900123456);
  });
  afterEach(() => {
    rmSync(directory, { recursive: true, force: true });
    jest.restoreAllMocks();
  });
  const succeed = (action?: (command: string) => void) =>
    jest.mocked(exec).mockImplementation(((
      command: string,
      _options: unknown,
      callback: (error: Error | null) => void,
    ) => {
      action?.(command);
      callback(null);
    }) as never);
  const fail = () =>
    jest.mocked(exec).mockImplementation(((
      _command: string,
      _options: unknown,
      callback: (error: Error) => void,
    ) => {
      callback(new Error('External process failed'));
    }) as never);

  it('[BE-BKP-100] {BackupRestoreService.createBackup} returns only a created dump and passes the test password through the environment', async () => {
    succeed((command) => {
      const path = command.match(/--file "([^"]+)"/)![1];
      writeFileSync(path, '-- test backup');
    });
    const path = await service.createBackup();
    expect(path).toBe(join(directory, 'backup_1791900123456.sql'));
    expect(existsSync(path)).toBe(true);
    const command = String(jest.mocked(exec).mock.calls[0][0]);
    expect(command).toContain('--port 55432');
    expect(command).toContain(
      '--clean --if-exists --column-inserts --no-owner',
    );
    expect(command).not.toContain(config.dbPassword);
    const options: any = jest.mocked(exec).mock.calls[0][1];
    expect(options.env.PGPASSWORD).toBe('test-only');
  });

  it('[BE-BKP-101] {BackupRestoreService.createBackup} process failure and missing dump file return the pinned generic 500', async () => {
    for (const setup of [fail, () => succeed()]) {
      setup();
      const error = await service.createBackup().catch((e) => e);
      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(500);
      expect(error.message).toBe('Failed to create backup');
      expect(existsSync(join(directory, 'backup_1791900123456.sql'))).toBe(
        false,
      );
    }
  });

  it('[BE-BKP-102] {BackupRestoreService.restoreBackup} removes an uploaded dump only after the external restore succeeds', async () => {
    const path = join(directory, 'uploaded.sql');
    writeFileSync(path, '-- test backup');
    succeed();
    await service.restoreBackup(path);
    expect(String(jest.mocked(exec).mock.calls[0][0])).toBe(
      `"/test/psql" -U test -h localhost -d posbuzz_test -f "${path}"`,
    );
    expect(existsSync(path)).toBe(false);
  });

  it('[BE-BKP-103] {BackupRestoreService.restoreBackup} restore failure keeps the upload and returns the pinned generic 500', async () => {
    const path = join(directory, 'uploaded.sql');
    writeFileSync(path, '-- test backup');
    fail();
    const error = await service.restoreBackup(path).catch((e) => e);
    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(500);
    expect(error.message).toBe('Failed to restore backup');
    expect(existsSync(path)).toBe(true);
  });
});
