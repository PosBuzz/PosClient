import { Module } from '@nestjs/common';
import { CategoryController } from './controllers/category.controller';
import { CategoryService } from './services/category.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  controllers: [CategoryController],
  providers: [CategoryService],
})
export class CategoryModule {}