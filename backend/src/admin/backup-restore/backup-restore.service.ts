import { Injectable, BadRequestException } from '@nestjs/common';
import { exec as execCb } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';

const exec = promisify(execCb);

@Injectable()
export class BackupRestoreService {
  async createBackup(): Promise<string> {
    const fileName = `backup_${Date.now()}.sql`;
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, fileName);

    const pgDumpPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\pg_dump.exe"`;

    let dumpCommand = `${pgDumpPath} --host ${process.env.DB_HOST} --port 5432 --username "${process.env.DB_USERNAME}" --role "${process.env.DB_USERNAME}" --format plain --file "${filePath}" "${process.env.DB_NAME}"`;
    dumpCommand += ` --clean --if-exists --column-inserts --no-owner`;

    await exec(dumpCommand, {
      env: {
        ...process.env,
        PGPASSWORD: process.env.DB_PASS,
      },
    });

    if (!fs.existsSync(filePath)) {
      throw new Error('Backup file was not created.');
    }

    return filePath;
  }

  async restoreBackup(filePath: string): Promise<void> {
    const psqlPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe"`;

    await exec(
      `${psqlPath} -U ${process.env.DB_USERNAME} -h ${process.env.DB_HOST} -d ${process.env.DB_NAME} -f "${filePath}"`,
      {
        env: { ...process.env, PGPASSWORD: process.env.DB_PASS },
      },
    );

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}