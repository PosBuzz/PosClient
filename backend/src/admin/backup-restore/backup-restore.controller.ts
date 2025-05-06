import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AdminAuthGuard } from 'src/auth/guards/admin.auth.guard';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { HasPermissions } from 'src/decorators/hasPermissions.decorator';
import { AdminPermission } from 'src/auth/enums/adminPermissions.enum';
import { BackupRestoreService } from './backup-restore.service';
import * as path from 'path';
import * as fs from 'fs';

@HasPermissions([AdminPermission.backupRestore])
@UseGuards(AdminAuthGuard, PermissionsGuard)
@Controller('admin')
export class BackupRestoreController {
  constructor(private readonly backupRestoreService: BackupRestoreService) {}

  @Get('backup')
  async backup(@Res() res: Response) {
    try {
      const filePath = await this.backupRestoreService.createBackup();
      const fileName = path.basename(filePath);

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
  async restore(@UploadedFile() file: any, @Res() res: Response) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const filePath = path.resolve(file.path);

    try {
      await this.backupRestoreService.restoreBackup(filePath);
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