import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { authTokenKey } from './constants';

type IIntercept = {
  intercept?: boolean;
};

type AxiosParam = InternalAxiosRequestConfig & IIntercept;

declare module 'axios' {
  export interface AxiosInstance {
    request<T = any>(config: AxiosRequestConfig & IIntercept): Promise<T>;
    get<T = any>(
      url: string,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
    delete<T = any>(
      url: string,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
    head<T = any>(
      url: string,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
    post<T = any>(
      url: string,
      data?: any,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
    put<T = any>(
      url: string,
      data?: any,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
    patch<T = any>(
      url: string,
      data?: any,
      config?: AxiosRequestConfig & IIntercept
    ): Promise<T>;
  }
}

export const baseURL = process.env.NEXT_PUBLIC_CONVEX_URL;
export const requestClientId = 'antigravity-chat';

const http = axios.create({
  baseURL,
  headers: {
    'request-client-id': requestClientId,
  },
});

http.interceptors.request.use((params: AxiosParam) => {
  const urlContent = window.location.pathname.split('/');
  if (urlContent.length === 2) {
    params.headers['x-locale-id'] = localStorage.getItem('locale') || 'en';
  } else if (urlContent.length > 2) {
    if (urlContent[1] === 'en') {
      params.headers['x-locale-id'] = localStorage.getItem('locale') || 'en';
    } else {
      params.headers['x-locale-id'] = localStorage.getItem('locale') || 'fr';
    }
  }

  if (!params?.intercept) return params;
  const storedToken = localStorage.getItem(authTokenKey);
  // Convex tokens are usually strings, but user code parses JSON. 
  // We'll adapt to handle both or just string if that's what Convex uses.
  // For now, following the snippet's logic but adding safety.
  let token = '';
  try {
    token = storedToken ? JSON.parse(storedToken) : '';
  } catch (e) {
    token = storedToken || '';
  }

  if (token) params.headers.Authorization = `Bearer ${token}`;

  return params;
});

http.interceptors.response.use(
  (response: any) => response,

  async (error: AxiosError) => {
    console.error('error.response.config', error?.response?.config);
    if (error?.response?.status === 401) {
      // Adapted logout logic
      const token = localStorage.getItem(authTokenKey);
      if (token) {
        localStorage.clear();
        sessionStorage.clear();
        // await authLogout(); // TODO: Implement non-hook auth logout if needed
      }
      localStorage.clear();
      sessionStorage.clear();
      window.location.replace('/login'); // Redirect to login instead of logged-out
    }
    return Promise.reject(error);
  }
);

const getServerError = (error: any) => {
  const message =
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    'An error occurred. Try again later';

  return message;
};

export { getServerError, http };
