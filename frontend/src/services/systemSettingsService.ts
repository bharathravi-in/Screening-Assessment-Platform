import api from '../config/api';

export interface SystemSettings {
  id: string;
  created_at: string;
  updated_at: string;
  // AI
  ai_providers_config: Record<string, {
    enabled: boolean;
    api_key: string;
    default_model: string;
    models: string[];
  }>;
  default_ai_provider: string;
  // Platform
  maintenance_mode: boolean;
  maintenance_message: string | null;
  allow_org_self_registration: boolean;
  max_orgs: number;
  max_users_per_org: number;
  max_assessments_per_org: number;
  max_candidates_per_assessment: number;
  // Security
  access_token_expire_minutes: number;
  refresh_token_expire_days: number;
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_numbers: boolean;
  password_require_special: boolean;
  max_login_attempts: number;
  lockout_duration_minutes: number;
  // Email
  smtp_host: string | null;
  smtp_port: number;
  smtp_username: string | null;
  smtp_password: string | null;
  smtp_from_address: string | null;
  smtp_from_name: string;
  smtp_use_tls: boolean;
  // Rate Limiting
  api_rate_limit_per_minute: number;
  candidate_rate_limit_per_minute: number;
}

export const systemSettingsService = {
  get: async (): Promise<SystemSettings> => {
    const { data } = await api.get('/system-settings/');
    return data;
  },
  update: async (req: Partial<SystemSettings>): Promise<SystemSettings> => {
    const { data } = await api.put('/system-settings/', req);
    return data;
  },
};
