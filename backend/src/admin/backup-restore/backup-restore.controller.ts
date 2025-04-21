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

  async getRelatedTables(table: string): Promise<string[]> {
    const query = `
      WITH all_constraints AS (
        SELECT 
          fk_tco.table_schema AS fk_schema,
          fk_tco.table_name AS fk_table,
          pk_tco.table_schema AS pk_schema,
          pk_tco.table_name AS pk_table
        FROM information_schema.referential_constraints rco
        JOIN information_schema.table_constraints fk_tco
          ON rco.constraint_name = fk_tco.constraint_name
          AND rco.constraint_schema = fk_tco.table_schema
        JOIN information_schema.table_constraints pk_tco
          ON rco.unique_constraint_name = pk_tco.constraint_name
          AND rco.unique_constraint_schema = pk_tco.table_schema
      )
      SELECT DISTINCT related_table FROM (
        SELECT fk_schema || '.' || quote_ident(fk_table) AS related_table
        FROM all_constraints
        WHERE pk_table = '${table}'
  
        UNION
  
        SELECT pk_schema || '.' || quote_ident(pk_table) AS related_table
        FROM all_constraints
        WHERE fk_table = '${table}'
      ) AS sub;
    `;

    const psqlPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe"`;
    console.log('Running SQL:\n', query);

    const { stdout } = await exec(
      `${psqlPath} -U ${process.env.DB_USERNAME} -h ${process.env.DB_HOST} -d ${process.env.DB_NAME} -t -c "${query}"`,
    );

    return stdout
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => !!l && l !== `public."${table}"`); // optionally exclude self
  }
  @Get('backup')
  async backup(@Query('tables') tables: string, @Res() res: Response) {
    const fileName = `backup_${Date.now()}.sql`;
    const tmpDir = os.tmpdir();
    const filePath = path.join(tmpDir, fileName);

    const pgDumpPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\pg_dump.exe"`;

    let allTables: string[] = [];

    if (tables) {
      const requestedTables = tables.split(',').map((t) => t.trim());

      // Get all related tables (foreign key dependencies)
      const relatedTables = new Set<string>();

      for (const table of requestedTables) {
        relatedTables.add(table); // include the main table

        const deps = await this.getRelatedTables(table);
        console.log(deps);

        deps.forEach((dep) => relatedTables.add(dep));
      }

      allTables = Array.from(relatedTables);
    }

    // Build pg_dump command
    let dumpCommand = `${pgDumpPath} --host ${process.env.DB_HOST} --port 5432 --username "${process.env.DB_USERNAME}" --role "${process.env.DB_USERNAME}" --format plain --file "${filePath}" "${process.env.DB_NAME}"`;

    if (allTables.length) {
      allTables.forEach((table) => {
        dumpCommand += ` --table="public.\\"${table}\\""`;
      });
    }

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
    @Query('mode') mode: 'merge' | 'replace' = 'merge',
    @Query('tables') tables: string,
    @Res() res: Response,
  ) {
    if (!file) throw new BadRequestException('No file uploaded.');

    const filePath = path.resolve(file.path);
    const psqlPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe"`;

    try {
      if (mode === 'replace' && tables) {
        // If replacing specific tables, first truncate them
        const tableList = tables
          .split(',')
          .map((table) => table.trim().toLowerCase());
        for (const table of tableList) {
          await exec(
            `${psqlPath} -U ${process.env.DB_USERNAME} -h ${process.env.DB_HOST} -d ${process.env.DB_NAME} -c "TRUNCATE TABLE \\"${table}\\" CASCADE;"`,
            {
              env: { ...process.env, PGPASSWORD: process.env.DB_PASS },
            },
          );
        }
      }

      // Execute the restore
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

  // Method to list available tables with correct casing
  @Get('tables')
  async listTables(@Res() res: Response) {
    const psqlPath = `"C:\\Users\\istia\\AppData\\Local\\com.tinyapp.DBngin\\Binaries\\postgresql\\17.0\\bin\\psql.exe"`;

    try {
      // This query gets the actual table names with proper casing from pg_class
      const { stdout } = await exec(
        `${psqlPath} -U ${process.env.DB_USERNAME} -h ${process.env.DB_HOST} -d ${process.env.DB_NAME} -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='public';"`,
        {
          env: { ...process.env, PGPASSWORD: process.env.DB_PASS },
        },
      );

      const tables = stdout
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return res.status(200).json(tables);
    } catch (err) {
      console.error(err);
      return res.status(500).send(`Failed to list tables: ${err.message}`);
    }
  }
}
