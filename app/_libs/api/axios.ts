import axios from "axios";
import { APP_CONFIG } from "@/app/_configs/app";

const baseAPI = axios.create({ baseURL: APP_CONFIG.api_url });

export { baseAPI };
