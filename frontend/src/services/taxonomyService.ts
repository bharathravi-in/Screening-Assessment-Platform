import api from '../config/api';
import type { Technology, Skill } from '../types/taxonomy';

export const taxonomyService = {
  async getTechnologies(): Promise<Technology[]> {
    const response = await api.get<Technology[]>('/taxonomy/technologies');
    return response.data;
  },

  async createTechnology(data: Partial<Technology>): Promise<Technology> {
    const response = await api.post<Technology>('/taxonomy/technologies', data);
    return response.data;
  },

  async updateTechnology(id: string, data: Partial<Technology>): Promise<Technology> {
    const response = await api.put<Technology>(`/taxonomy/technologies/${id}`, data);
    return response.data;
  },

  async deleteTechnology(id: string): Promise<void> {
    await api.delete(`/taxonomy/technologies/${id}`);
  },

  async getSkills(technologyId: string): Promise<Skill[]> {
    const response = await api.get<{ skills: Skill[] }>(`/taxonomy/technologies/${technologyId}/skills`);
    return response.data.skills || [];
  },

  async createSkill(data: Partial<Skill>): Promise<Skill> {
    const response = await api.post<Skill>('/taxonomy/skills', data);
    return response.data;
  },

  async updateSkill(id: string, data: Partial<Skill>): Promise<Skill> {
    const response = await api.put<Skill>(`/taxonomy/skills/${id}`, data);
    return response.data;
  },

  async deleteSkill(id: string): Promise<void> {
    await api.delete(`/taxonomy/skills/${id}`);
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async aiGenerate(body: { topic?: string; job_description?: string; context?: string; count?: number; auto_save?: boolean }): Promise<any> {
    const response = await api.post('/taxonomy/ai-generate', body);
    return response.data;
  },

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async bulkUpload(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/taxonomy/bulk-upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
