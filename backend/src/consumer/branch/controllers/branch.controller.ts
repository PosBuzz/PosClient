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
} from '@nestjs/common';
import { BranchService } from '../services/branch.service';
import { CreateBranchDto } from '../dto/create-branch.dto';
import { UpdateBranchDto } from '../dto/update-branch.dto';
import { ClientAuthGuard } from '../../../auth/guards/client.auth.guard';
import { PermissionsGuard } from '../../../auth/guards/permissions.guard';
import { HasPermissions } from '../../../decorators/hasPermissions.decorator';
import { ConsumerPermission } from '../../../auth/enums/consumerPermissions.enum';
import { Request } from 'express';

@UseGuards(ClientAuthGuard, PermissionsGuard)
@HasPermissions([ConsumerPermission.branches])
@Controller('consumer/branches')
export class BranchController {
  constructor(private readonly branchService: BranchService) {}
  
  @Post()
  async create(@Body() createBranchDto: CreateBranchDto, @Req() req: Request) {
    return this.branchService.create(createBranchDto, req.user.id);
  }
  
  @Get()
  async findAll(@Req() req: Request) {
    return this.branchService.findAll(req.user.id);
  }

  @Get('options')
  async getBranchOptions(@Req() req: Request) {
    return this.branchService.getBranchOptions(req.user.id);
  }
  
  @Get(':id')
  async findOne(@Param('id') id: string, @Req() req: Request) {
    return this.branchService.findOne(+id, req.user.id);
  }
  
  @Patch(':id')
  async update(
    @Param('id') id: string, 
    @Body() updateBranchDto: UpdateBranchDto,
    @Req() req: Request
  ) {
    return this.branchService.update(+id, updateBranchDto, req.user.id);
  }
  
  @Delete(':id')
  async remove(@Param('id') id: string, @Req() req: Request) {
    return this.branchService.remove(+id, req.user.id);
  }
  
  @Patch(':id/set-main')
  async setMainBranch(@Param('id') id: string, @Req() req: Request) {
    return this.branchService.setMainBranch(+id, req.user.id);
  }
}