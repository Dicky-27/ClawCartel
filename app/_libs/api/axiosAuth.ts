import axios from "axios";
import { APP_CONFIG } from "@/app/_configs/app";

const authAPI = axios.create({ baseURL: APP_CONFIG.api_url });

authAPI.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem(APP_CONFIG.token_storage_key);
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error),
);

authAPI.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem(APP_CONFIG.token_storage_key);
    }

    // Log the error for debugging
    console.error("API Error:", {
      status: error.response?.status || 500,
      message: error.response?.data?.message || error.message,
      url: error.config?.url,
    });

    return Promise.reject(error);
  },
);

export { authAPI };
