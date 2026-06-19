import { BadRequestException } from '@nestjs/common';

export interface PaginationQuery {
  page?: number | string;
  pageSize?: number | string;
}

export interface PaginationOptions {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

function parsePositiveInteger(value: number | string | undefined, fallback: number) {
  if (value === undefined || value === '') {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new BadRequestException('Pagination parameters must be positive integers');
  }

  return parsed;
}

export function getPagination(query: PaginationQuery): PaginationOptions {
  const page = parsePositiveInteger(query.page, 1);
  const pageSize = Math.min(parsePositiveInteger(query.pageSize, 20), 100);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}
