import api from '../config/api';
import type {
  CandidateInvitation,
  InvitationListResponse,
  SessionDetail,
  SessionListResponse,
} from '../types/assessment';

export interface InviteData {
  assessment_id: string;
  candidate_email: string;
  candidate_name: string;
  expires_at?: string;
}

export interface BulkInviteData {
  assessment_id: string;
  candidates: InviteData[];
}

export interface InvitationListParams {
  page?: number;
  page_size?: number;
  assessment_id?: string;
  status?: string;
  search?: string;
}

export interface SessionListParams {
  page?: number;
  page_size?: number;
  assessment_id?: string;
  status?: string;
}

export const candidateService = {
  async inviteCandidate(data: InviteData): Promise<CandidateInvitation> {
    const response = await api.post<CandidateInvitation>('/candidates/invite', data);
    return response.data;
  },

  async bulkInvite(data: BulkInviteData): Promise<CandidateInvitation[]> {
    const response = await api.post<CandidateInvitation[]>('/candidates/invite/bulk', data);
    return response.data;
  },

  async getInvitations(params: InvitationListParams = {}): Promise<InvitationListResponse> {
    const response = await api.get<InvitationListResponse>('/candidates/invitations/', { params });
    return response.data;
  },

  async getInvitation(id: string): Promise<CandidateInvitation> {
    const response = await api.get<CandidateInvitation>(`/candidates/invitations/${id}`);
    return response.data;
  },

  async updateInvitation(id: string, data: { status?: string; expires_at?: string }): Promise<CandidateInvitation> {
    const response = await api.put<CandidateInvitation>(`/candidates/invitations/${id}`, data);
    return response.data;
  },

  async getSessions(params: SessionListParams = {}): Promise<SessionListResponse> {
    const response = await api.get<SessionListResponse>('/candidates/sessions/', { params });
    return response.data;
  },

  async getSession(id: string): Promise<SessionDetail> {
    const response = await api.get<SessionDetail>(`/candidates/sessions/${id}`);
    return response.data;
  },

  async uploadCSV(assessmentId: string, file: File): Promise<{ invited: number; skipped: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post(`/candidates/invite/upload-csv?assessment_id=${assessmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  async downloadCSVTemplate(): Promise<void> {
    const csv = 'email,name\njohn.doe@example.com,John Doe\njane.smith@example.com,Jane Smith\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invite_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
