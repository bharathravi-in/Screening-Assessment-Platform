import api from '../config/api';

export interface UserItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  organization_id: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserListResponse {
  users: UserItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserCreateRequest {
  email: string;
  full_name: string;
  role: string;
  password: string;
  organization_id?: string;
}

export interface UserUpdateRequest {
  full_name?: string;
  is_active?: boolean;
  organization_id?: string;
}

export const userService = {
  list: async (
    page = 1,
    pageSize = 20,
    role?: string,
    search?: string,
    orgId?: string
  ): Promise<UserListResponse> => {
    const params: Record<string, unknown> = { page, page_size: pageSize };
    if (role) params.role = role;
    if (search) params.search = search;
    if (orgId) params.org_id = orgId;
    const { data } = await api.get('/users/', { params });
    return data;
  },

  get: async (id: string): Promise<UserItem> => {
    const { data } = await api.get(`/users/${id}`);
    return data;
  },

  create: async (req: UserCreateRequest): Promise<UserItem> => {
    const { data } = await api.post('/users/', req);
    return data;
  },

  update: async (id: string, req: UserUpdateRequest): Promise<UserItem> => {
    const { data } = await api.put(`/users/${id}`, req);
    return data;
  },

  updateRole: async (id: string, role: string): Promise<UserItem> => {
    const { data } = await api.put(`/users/${id}/role`, { role });
    return data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};
