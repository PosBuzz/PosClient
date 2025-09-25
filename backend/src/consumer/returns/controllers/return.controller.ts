import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  ParseIntPipe,
} from '@nestjs/common';
import { ReturnService } from '../services/return.service';
import { CreateReturnDto } from '../dto/create-return.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.returns])
@Controller('consumer/returns')
export class ReturnController {
  constructor(
    private readonly returnService: ReturnService,
  ) {}

  @Post()
  async create(@Body() createReturnDto: CreateReturnDto, @Req() req: Request) {
    return this.returnService.create(
      req.user.consumer_id!,
      req.user.id,
      createReturnDto,
    );
  }

  @Get()
  async findAll(
    @Req() req: Request,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '10',
    @Query('branch_id') branchId?: string,
    @Query('original_sale_id') originalSaleId?: string,
  ) {
    return this.returnService.findAll(req.user.consumer_id!, {
      page: parseInt(page),
      limit: parseInt(limit),
      branch_id: branchId ? parseInt(branchId) : undefined,
      original_sale_id: originalSaleId ? parseInt(originalSaleId) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
  ) {
    return this.returnService.findOne(id, req.user.consumer_id!);
  }
}
