import api from '../config/api';

export interface OverviewStats {
  total_assessments: number;
  active_assessments: number;
  total_invitations: number;
  total_sessions: number;
  completed_sessions: number;
  completion_rate: number;
  avg_score_pct: number | null;
  pass_rate: number | null;
}

export interface ScoreBucket {
  range: string;
  count: number;
}

export interface StatusCount {
  status: string;
  count: number;
}

export interface AssessmentStat {
  assessment_id: string;
  title: string;
  sessions: number;
  avg_score: number | null;
  pass_rate: number | null;
  completions: number;
}

export interface DifficultyPerformance {
  difficulty: string;
  avg_score_pct: number | null;
  count: number;
}

export interface TypePerformance {
  question_type: string;
  avg_score_pct: number | null;
  count: number;
}

export interface DailyCount {
  date: string;
  count: number;
}

export interface AnalyticsOverview {
  overview: OverviewStats;
  score_distribution: ScoreBucket[];
  session_statuses: StatusCount[];
  invitation_statuses: StatusCount[];
  top_assessments: AssessmentStat[];
  difficulty_performance: DifficultyPerformance[];
  type_performance: TypePerformance[];
  daily_sessions: DailyCount[];
}

export const analyticsService = {
  getOverview: async (days = 30): Promise<AnalyticsOverview> => {
    const { data } = await api.get('/analytics/overview', { params: { days } });
    return data;
  },
};
