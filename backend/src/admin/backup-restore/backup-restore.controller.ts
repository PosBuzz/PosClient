import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { exec as execCb } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { BackupRestoreService } from './backup-restore.service';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

const exec = promisify(execCb);

@UseGuards(AdminAuthGuard)
@Controller('admin')
export class BackupRestoreController {
  constructor(private readonly backupRestoreService: BackupRestoreService) {}

  @Get('backup')
  async backup(@Res() res: Response) {
    const fileName = `backup_${Date.now()}.sql`;
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, fileName);

    const pgDumpPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\pg_dump.exe"`;

    // Build pg_dump command to backup all tables
    let dumpCommand = `${pgDumpPath} --host ${process.env.DB_HOST} --port 5432 --username "${process.env.DB_USERNAME}" --role "${process.env.DB_USERNAME}" --format plain --file "${filePath}" "${process.env.DB_NAME}"`;

    dumpCommand += ` --clean --if-exists --column-inserts --no-owner`;

    try {
      await exec(dumpCommand, {
        env: {
          ...process.env,
          PGPASSWORD: process.env.DB_PASS,
        },
      });

      if (!fs.existsSync(filePath)) {
        throw new Error('Backup file was not created.');
      }

      res.download(filePath, fileName, (err) => {
        if (err) console.error('Download failed:', err);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    } catch (err) {
      console.error(err);
      res.status(500).send(`Backup failed: ${err.message}`);
    }
  }

  @Post('restore')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: './uploads',
        filename: (_, file, cb) => cb(null, `restore_${Date.now()}.sql`),
      }),
    }),
  )
  async restore(
    @UploadedFile() file: any,
    @Res() res: Response,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const filePath = path.resolve(file.path);
    const psqlPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe"`;

    try {
      // Execute the restore (always in merge mode)
      await exec(
        `${psqlPath} -U ${process.env.DB_USERNAME} -h ${process.env.DB_HOST} -d ${process.env.DB_NAME} -f "${filePath}"`,
        {
          env: { ...process.env, PGPASSWORD: process.env.DB_PASS },
        },
      );

      // Cleanup
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(200).send('Database restored successfully.');
    } catch (err) {
      console.error(err);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return res.status(500).send(`Restore failed: ${err.message}`);
    }
  }
}
