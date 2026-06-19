import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  StreamableFile
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

interface ApiSuccessResponse<TData> {
  success: true;
  data: TData;
  message: string;
  timestamp: string;
}

function isApiResponse(value: unknown): value is { success: boolean } {
  return Boolean(value && typeof value === 'object' && 'success' in value);
}

@Injectable()
export class ApiResponseInterceptor<TData> implements NestInterceptor<
  TData,
  ApiSuccessResponse<TData> | TData
> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<TData>
  ): Observable<ApiSuccessResponse<TData> | TData> {
    return next.handle().pipe(
      map((data) => {
        if (data instanceof StreamableFile) {
          return data;
        }

        if (isApiResponse(data)) {
          return data;
        }

        return {
          success: true,
          data,
          message: 'ok',
          timestamp: new Date().toISOString()
        };
      })
    );
  }
}
