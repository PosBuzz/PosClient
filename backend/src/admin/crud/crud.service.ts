import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { UpdateCrudDto } from './dto/update-crud.dto';

@Injectable()
export class CrudService {
  private readonly logger = new Logger(CrudService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(body: any, model: string) {
    try {
      const result = await this.prismaService[model].create({
        data: body,
      });

      return result;
    } catch (error) {
      this.logger.error(`Create failed for model: ${model}`, error.stack);
      throw new HttpException(
        'Failed to create record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAll(model: string) {
    try {
      return await this.prismaService[model].findMany({
        orderBy: { id: 'asc' },
      });
    } catch (error) {
      this.logger.error(`FindAll failed for model: ${model}`, error.stack);
      throw new HttpException(
        'Failed to fetch records',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findOne(id: number, model: string) {
    try {
      const result = await this.prismaService[model].findFirst({
        where: { id },
      });

      if (!result) {
        throw new HttpException('Record not found', HttpStatus.NOT_FOUND);
      }

      return result;
    } catch (error) {
      this.logger.error(
        `FindOne failed for model: ${model}, id: ${id}`,
        error.stack,
      );
      throw new HttpException(
        error.message || 'Failed to fetch record',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(id: number, updateCrudDto: UpdateCrudDto, model: string) {
    try {
      const result = await this.prismaService[model].update({
        where: { id },
        data: updateCrudDto,
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Update failed for model: ${model}, id: ${id}`,
        error.stack,
      );

      throw new HttpException(
        'Failed to update record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async remove(id: number, model: string) {
    try {
      await this.prismaService[model].delete({ where: { id } });

      return { success: true };
    } catch (error) {
      this.logger.error(
        `Delete failed for model: ${model}, id: ${id}`,
        error.stack,
      );

      throw new HttpException(
        'Failed to delete record',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async findAllByWhere(model: string, body: any) {
    try {
      let findClause: any = {};

      if (body.where) {
        findClause.where = body.where;
      }

      if (body.include) {
        findClause.include = body.include;
      }

      findClause.orderBy = body.orderBy || { id: 'asc' };

      return await this.prismaService[model].findMany(findClause);
    } catch (error) {
      this.logger.error(
        `findAllByWhere failed for model: ${model}`,
        error.stack,
      );

      throw new HttpException(
        'Failed to fetch filtered records',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async search(query: string, model: string, data: any) {
    try {
      const whereClause: any = {};

      const search = data?.map((item) => ({
        [item?.value]: { contains: query, mode: 'insensitive' },
      }));

      if (search?.length) {
        whereClause.OR = search;
      }

      const searchResults = await this.prismaService[model].findMany({
        where: whereClause,
        orderBy: { id: 'asc' },
      });

      return searchResults;
    } catch (error) {
      this.logger.error(`Search failed for model: ${model}`, error.stack);

      throw new HttpException(
        'Search failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}