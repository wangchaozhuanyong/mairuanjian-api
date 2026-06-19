import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

interface ErrorResponseBody {
  success: false;
  errorCode: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

interface HttpResponse {
  status(statusCode: number): {
    json(body: ErrorResponseBody): unknown;
  };
}

function getErrorMessage(response: string | object): string {
  if (typeof response === 'string') {
    return response;
  }

  if ('message' in response) {
    const message = response.message;
    return Array.isArray(message) ? message.join('; ') : String(message);
  }

  return 'Request failed';
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp();
    const response = context.getResponse<HttpResponse>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const body: ErrorResponseBody = {
      success: false,
      errorCode: exception instanceof HttpException ? exception.name : 'INTERNAL_SERVER_ERROR',
      message: getErrorMessage(exceptionResponse),
      timestamp: new Date().toISOString()
    };

    if (typeof exceptionResponse === 'object') {
      body.details = exceptionResponse;
    }

    response.status(status).json(body);
  }
}
