// src/description/description.service.ts
import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { GenerateDescriptionDto } from '../dto/generate-description.dto';

@Injectable()
export class DescriptionService {
  private readonly FASTAPI_BASE_URL = process.env.FASTAPI_URL;

  constructor(private readonly httpService: HttpService) {}

  async generateDescription(
    dto: GenerateDescriptionDto,
    jwt: string,
  ): Promise<string> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<{ description: string }>(
          `${this.FASTAPI_BASE_URL}/generate-description`,
          dto,
          {
            headers: {
              Authorization: `Bearer ${jwt}`,
            },
          },
        ),
      );
      return response.data.description;
    } catch (err) {
      console.error('Error calling FastAPI:', err);
      throw err;
    }
  }
}
