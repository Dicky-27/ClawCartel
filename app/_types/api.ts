// Standard API response wrapper types
export interface ApiResponse<T = unknown> {
  status: number;
  code: string;
  message: string;
  data: T;
}

// API error response
export interface ApiError {
  status: number;
  code: string;
  message: string;
}

export interface Filters {
  page?: number;
  limit?: number;
  filterKeys?: string;
  filterOperators?: string;
  filterValues?: string;
  orderBy?: string;
}

// Pagination
export interface Pagination<T = unknown> {
  limit: number;
  count: number;
  total: number;
  page: number;
  totalPage: number;
  data: T[];
}
