import { Module } from '@nestjs/common';
import { BranchController } from './controllers/branch.controller';
import { BranchService } from './services/branch.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  controllers: [BranchController],
  providers: [BranchService],
  exports: [BranchService],
})
export class BranchModule {}