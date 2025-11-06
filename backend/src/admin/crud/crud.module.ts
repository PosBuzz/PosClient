/* eslint-disable */
import { Module } from '@nestjs/common';
import { CrudController } from './crud.controller';
import { CrudService } from './crud.service';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [CrudController],
  providers: [CrudService],
})
export class CrudModule {}
