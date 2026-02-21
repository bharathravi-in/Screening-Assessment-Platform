import api from '../config/api';

export interface OrgItem {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgListResponse {
  organizations: OrgItem[];
  total: number;
}

export interface OrgCreateRequest {
  name: string;
  slug: string;
  logo_url?: string;
}

export interface OrgUpdateRequest {
  name?: string;
  logo_url?: string;
  is_active?: boolean;
}

export interface OrgSettings {
  id: string;
  organization_id: string;
  theme_config: Record<string, string>;
  proctoring_defaults: Record<string, boolean>;
  max_violation_warnings: number;
  auto_terminate_on_violations: boolean;
  allowed_ai_providers: string[];
  assessment_defaults: Record<string, unknown>;
  notification_config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface OrgSettingsUpdateRequest {
  theme_config?: Record<string, string>;
  proctoring_defaults?: Record<string, boolean>;
  max_violation_warnings?: number;
  auto_terminate_on_violations?: boolean;
  allowed_ai_providers?: string[];
  assessment_defaults?: Record<string, unknown>;
  notification_config?: Record<string, unknown>;
}

export const orgService = {
  list: async (): Promise<OrgListResponse> => {
    const { data } = await api.get('/organizations/');
    return data;
  },

  get: async (id: string): Promise<OrgItem> => {
    const { data } = await api.get(`/organizations/${id}`);
    return data;
  },

  create: async (req: OrgCreateRequest): Promise<OrgItem> => {
    const { data } = await api.post('/organizations/', req);
    return data;
  },

  update: async (id: string, req: OrgUpdateRequest): Promise<OrgItem> => {
    const { data } = await api.put(`/organizations/${id}`, req);
    return data;
  },

  getSettings: async (orgId: string): Promise<OrgSettings> => {
    const { data } = await api.get(`/organizations/${orgId}/settings`);
    return data;
  },

  updateSettings: async (
    orgId: string,
    req: OrgSettingsUpdateRequest
  ): Promise<OrgSettings> => {
    const { data } = await api.put(`/organizations/${orgId}/settings`, req);
    return data;
  },
};
