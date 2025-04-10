/* eslint-disable */

import { Injectable } from '@nestjs/common';
import { UpdateCrudDto } from './dto/update-crud.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class CrudService {
  constructor(private readonly prismaService: PrismaService) {}
  //TODO add type of the body based on the model
  async create(body: any, model: string) {
    // console.log(body);
    return await this.prismaService[model].create({
      data: body,
    });
  }

  async findAll(model: string) {
    return await this.prismaService[model].findMany({
      orderBy: {
        id: 'asc',
      },
    });
  }

  async findOne(id: number, model: string) {
    return await this.prismaService[model].findFirst({ where: { id } });
  }

  async update(id: number, updateCrudDto: UpdateCrudDto, model: string) {
    return await this.prismaService[model].update({
      where: { id },
      data: updateCrudDto,
    });
  }

  async remove(id: number, model: string) {
    try {
      await this.prismaService[model].delete({ where: { id } });
    } catch (e) {
      return { success: false };
    }
    return { success: true };
  }

async findAllByWhere(model: string, body: any) {
    let findClause: any = {};
    if (body.where) {
      findClause.where = body.where;
    }
    if (body.include) {
      findClause.include = body.include;
    }
    findClause.orderBy = {
      id: 'asc',
    };

    if (body.orderBy) {
      findClause.orderBy = body.orderBy;
    }

    return this.prismaService[model].findMany(findClause);
  }

  async search(query, model: string, data: any) {
    const whereClause: any = {};
    const search = data?.map((item) => {
      return {
        [item?.value]: { contains: query, mode: 'insensitive' },
      };
    });
    if (search.length) {
      whereClause.OR = search;
    }

    const searchResults = await this.prismaService[model].findMany({
      where: whereClause,
      orderBy: { id: 'asc' },
    });

    return searchResults;
  }
}
