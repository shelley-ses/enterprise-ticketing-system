// API Config
export const API_BASE_URL = import.meta.env.VITE_API_URL;
export const SANCTUM_URL = import.meta.env.VITE_SANCTUM_URL;

if(!API_BASE_URL){
  throw new Error("Missing VITE_API_URL in environment variables");
}

if(!SANCTUM_URL){
  throw new Error("Missing SANCTUM_URL in environment variables");
}

// CSRF Config (Sanctum)
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const CSRF_HEADER_NAME = 'X-XSRF-TOKEN';

// API Endpoints
export const AUTH_ENDPOINTS = {
  LOGIN: '/login',
  LOGOUT: '/logout',
  CSRF_TOKEN: '/sanctum/csrf-cookie',
  VERIFY_EMAIL: '/email/verify',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  REFRESH_TOKEN: '/auth/refresh',
  ME: '/me',
};

// HTTP Status Codes
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500,
};
