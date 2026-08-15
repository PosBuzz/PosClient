import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { ConfigService } from '../../config/config.service';
import { errorStack } from '../../common/utils/error.util';

const exec = promisify(execCb);

@Injectable()
export class BackupRestoreService {
  private readonly logger = new Logger(BackupRestoreService.name);

  constructor(private readonly configService: ConfigService) {}

  async createBackup(): Promise<string> {
    try {
      const fileName = `backup_${Date.now()}.sql`;
      const tmpDir = os.tmpdir();
      const filePath = path.join(tmpDir, fileName);

      const pgDumpPath = `"${this.configService.pgDumpPath}"`;
      const dbHost = this.configService.dbHost;
      const dbPort = this.configService.dbPort;
      const dbUsername = this.configService.dbUsername;
      const dbName = this.configService.dbName;

      let dumpCommand = `${pgDumpPath} --host ${dbHost} --port ${dbPort} --username "${dbUsername}" --role "${dbUsername}" --format plain --file "${filePath}" "${dbName}"`;
      dumpCommand += ` --clean --if-exists --column-inserts --no-owner`;

      await exec(dumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: this.configService.dbPassword,
        },
      });

      if (!fs.existsSync(filePath)) {
        throw new Error('Backup file was not created.');
      }

      return filePath;
    } catch (error) {
      this.logger.error(`Failed to create backup`, errorStack(error));
      throw new HttpException(
        'Failed to create backup',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async restoreBackup(filePath: string): Promise<void> {
    try {
      const psqlPath = `"${this.configService.psqlPath}"`;
      const dbHost = this.configService.dbHost;
      const dbUsername = this.configService.dbUsername;
      const dbName = this.configService.dbName;

      await exec(
        `${psqlPath} -U ${dbUsername} -h ${dbHost} -d ${dbName} -f "${filePath}"`,
        {
          env: {
            ...process.env,
            PGPASSWORD: this.configService.dbPassword,
          },
        },
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      this.logger.error(`Failed to restore backup`, errorStack(error));
      throw new HttpException(
        'Failed to restore backup',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
