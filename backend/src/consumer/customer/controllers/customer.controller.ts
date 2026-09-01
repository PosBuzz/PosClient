import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { CustomerService } from '../services/customer.service';
import { CreateCustomerDto } from '../dto/create-customer.dto';
import { UpdateCustomerDto } from '../dto/update-customer.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.customers])
@Controller('consumer/customers')
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Post()
  async create(
    @Body() createCustomerDto: CreateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customerService.create(
      createCustomerDto,
      Number(req.user.consumer_id),
    );
  }

  @Get()
  async findAll(
    @Query('search') searchQuery: string,
    @Query('customer_type') customerType: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    const filters = {
      search: searchQuery,
      customer_type: customerType,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    };

    return this.customerService.findAllWithFilters(
      filters,
      Number(req.user.consumer_id),
    );
  }

  @Get(':id/summary')
  async getSummary(@Param('id') id: string, @Req() req: Request) {
    return this.customerService.getSummary(+id, Number(req.user.consumer_id));
  }

  @Get(':id/sales')
  async getSalesHistory(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    return this.customerService.getSalesHistory(
      +id,
      Number(req.user.consumer_id),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id/returns')
  async getReturnsHistory(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    return this.customerService.getReturnsHistory(
      +id,
      Number(req.user.consumer_id),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id/rewards')
  async getRewardsHistory(
    @Param('id') id: string,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Req() req: Request,
  ) {
    return this.customerService.getRewardsHistory(
      +id,
      Number(req.user.consumer_id),
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.customerService.findOne(+id, Number(req.user.consumer_id));
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCustomerDto: UpdateCustomerDto,
    @Req() req: Request,
  ) {
    return this.customerService.update(
      +id,
      updateCustomerDto,
      Number(req.user.consumer_id),
    );
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.customerService.remove(+id, Number(req.user.consumer_id));
  }
}
