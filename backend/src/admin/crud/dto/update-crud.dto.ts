import { PartialType } from '@nestjs/swagger';
import { CreateCrudDto } from './create-crud.dto';

export class UpdateCrudDto extends PartialType(CreateCrudDto) {}
