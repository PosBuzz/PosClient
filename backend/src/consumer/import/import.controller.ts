import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { ConsumerPermission } from '../../auth/enums/consumerPermissions.enum';
import { ClientAuthGuard } from '../../auth/guards/client.auth.guard';
import { ImportEntity } from './import.types';
import { ImportService } from './services/import.service';

/** Permission a user needs to import each entity — same as creating one by hand */
const PERMISSION_BY_ENTITY: Record<ImportEntity, ConsumerPermission> = {
  products: ConsumerPermission.add_product,
  inventory: ConsumerPermission.inventory_batches,
  customers: ConsumerPermission.customers,
};

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Shape of a memory-storage upload; @types/multer is not installed */
interface UploadedSpreadsheet {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

@Controller('consumer/import')
@UseGuards(ClientAuthGuard)
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Get(':entity/template')
  async downloadTemplate(
    @Param('entity') entity: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const parsed = this.resolveEntity(entity, req);
    const buffer = await this.importService.buildTemplate(parsed);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${parsed}-import-template.xlsx"`,
    );
    res.send(buffer);
  }

  /** Column spec, so the UI can describe the file without hardcoding it */
  @Get(':entity/columns')
  columns(@Param('entity') entity: string, @Req() req: Request) {
    const parsed = this.resolveEntity(entity, req);
    return { entity: parsed, columns: this.importService.columnsFor(parsed) };
  }

  /** Validate only — never writes, so the UI can show problems before committing */
  @Post(':entity/preview')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async preview(
    @Param('entity') entity: string,
    @UploadedFile() file: UploadedSpreadsheet,
    @Req() req: Request,
  ) {
    const parsed = this.resolveEntity(entity, req);
    return this.importService.run(
      parsed,
      req.user.consumer_id!,
      req.user.id,
      this.fileBuffer(file),
      true,
    );
  }

  @Post(':entity')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }),
  )
  async import(
    @Param('entity') entity: string,
    @UploadedFile() file: UploadedSpreadsheet,
    @Req() req: Request,
    @Query('dryRun') dryRun?: string,
  ) {
    const parsed = this.resolveEntity(entity, req);
    return this.importService.run(
      parsed,
      req.user.consumer_id!,
      req.user.id,
      this.fileBuffer(file),
      dryRun === 'true',
    );
  }

  private resolveEntity(entity: string, req: Request): ImportEntity {
    this.importService.assertKnownEntity(entity);

    const required = PERMISSION_BY_ENTITY[entity];
    if (!req.user?.permissions?.includes(required)) {
      throw new ForbiddenException(
        `You do not have permission to import ${entity}.`,
      );
    }

    return entity;
  }

  private fileBuffer(file: UploadedSpreadsheet): Buffer {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attach an .xlsx file to upload.');
    }
    return file.buffer;
  }
}
