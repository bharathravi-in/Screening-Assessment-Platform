import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Shield,
  Brain,
  Loader2,
  ChevronDown,
  ChevronUp,
  Code,
  MessageSquare,
  Activity,
  Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { aiService } from '../../services/aiService';
import type { AIEvaluationResult } from '../../services/aiService';
import { candidateService } from '../../services/candidateService';
import type { SessionDetail } from '../../types/assessment';
import CodePlaybackViewer from '../../components/evaluation/CodePlaybackViewer';
import CandidateInsights from '../../components/evaluation/CandidateInsights';

interface QuestionEvaluation {
  question_id: string;
  question_title?: string;
  question_type?: string;
  score: number;
  max_score: number;
  feedback: string;
  strengths?: string[];
  weaknesses?: string[];
  code_execution?: {
    test_cases: Array<{
      input: string;
      expected_output: string;
      actual_output: string;
      passed: boolean;
      is_hidden?: boolean;
    }>;
    total_passed: number;
    total_cases: number;
  };
}

interface SkillScore {
  skill: string;
  score: number;
  max_score: number;
}

interface ProctoringFinding {
  type: string;
  description: string;
  timestamp?: string;
  severity?: string;
}

interface ProctoringReport {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  findings: ProctoringFinding[];
  recommendation: string;
  summary?: string;
}

const riskLevelConfig: Record<string, { color: string; bg: string; label: string }> = {
  low: { color: 'var(--success)', bg: 'rgba(16,185,129,0.12)', label: 'Low Risk' },
  medium: { color: 'var(--warning)', bg: 'rgba(245,158,11,0.12)', label: 'Medium Risk' },
  high: { color: 'var(--danger)', bg: 'rgba(239,68,68,0.12)', label: 'High Risk' },
  critical: { color: '#dc2626', bg: 'rgba(220,38,38,0.15)', label: 'Critical Risk' },
};

export default function EvaluationPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<SessionDetail | null>(null);
  const [evaluation, setEvaluation] = useState<AIEvaluationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'evaluation' | 'playback' | 'insights'>('evaluation');
  const [selectedQuestionForPlayback, setSelectedQuestionForPlayback] = useState<string>('');

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      try {
        const data = await candidateService.getSession(sessionId);
        setSession(data);
      } catch {
        toast.error('Failed to load session details');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId]);

  const handleRunEvaluation = useCallback(async () => {
    if (!session || !sessionId) return;
    setEvaluating(true);
    try {
      const result = await aiService.evaluateSession(session.assessment_id, sessionId);
      setEvaluation(result);
      toast.success('AI evaluation completed successfully');
    } catch {
      toast.error('Failed to run AI evaluation');
    } finally {
      setEvaluating(false);
    }
  }, [session, sessionId]);

  const toggleQuestion = useCallback((questionId: string) => {
    setExpandedQuestions((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  }, []);

  // Derived data from evaluation
  const questionEvaluations: QuestionEvaluation[] = evaluation?.ai_evaluations
    ? (Array.isArray(evaluation.ai_evaluations)
      ? evaluation.ai_evaluations
      : Object.values(evaluation.ai_evaluations)) as QuestionEvaluation[]
    : [];

  const proctoringReport: ProctoringReport | null = evaluation?.proctoring_report
    ? (evaluation.proctoring_report as unknown as ProctoringReport)
    : null;

  const skillScores: SkillScore[] = (() => {
    const skillMap = new Map<string, { total: number; max: number }>();
    for (const qe of questionEvaluations) {
      const evalObj = qe as unknown as Record<string, unknown>;
      const skills = (evalObj.skills ?? evalObj.skill_names ?? []) as string[];
      for (const skill of skills) {
        const existing = skillMap.get(skill) || { total: 0, max: 0 };
        existing.total += qe.score;
        existing.max += qe.max_score;
        skillMap.set(skill, existing);
      }
    }
    return Array.from(skillMap.entries()).map(([skill, { total, max }]) => ({
      skill,
      score: total,
      max_score: max,
    }));
  })();

  const radarData = skillScores.map((s) => ({
    skill: s.skill,
    score: s.max_score > 0 ? Math.round((s.score / s.max_score) * 100) : 0,
    fullMark: 100,
  }));

  const overallScorePct =
    evaluation?.score_pct != null
      ? evaluation.score_pct
      : evaluation
        ? evaluation.total_max_score > 0
          ? Math.round((evaluation.total_score / evaluation.total_max_score) * 100)
          : 0
        : null;

  // --- Loading state ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading session details...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="text-center py-24">
        <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
          Session not found
        </p>
        <button
          onClick={() => navigate('/hr/candidates')}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
        >
          Back to Candidates
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg mt-1"
          style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              AI Evaluation
            </h1>
            {overallScorePct != null && (
              <span
                className="px-3 py-1 rounded-full text-sm font-semibold"
                style={{
                  backgroundColor:
                    overallScorePct >= 70
                      ? 'rgba(16,185,129,0.12)'
                      : overallScorePct >= 40
                        ? 'rgba(245,158,11,0.12)'
                        : 'rgba(239,68,68,0.12)',
                  color:
                    overallScorePct >= 70
                      ? 'var(--success)'
                      : overallScorePct >= 40
                        ? 'var(--warning)'
                        : 'var(--danger)',
                }}
              >
                {overallScorePct.toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {session.candidate_name} -- {session.candidate_email}
          </p>
        </div>
        <button
          onClick={handleRunEvaluation}
          disabled={evaluating}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-opacity"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
            opacity: evaluating ? 0.7 : 1,
            cursor: evaluating ? 'not-allowed' : 'pointer',
          }}
        >
          {evaluating ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Evaluating...
            </>
          ) : (
            <>
              <Play size={16} />
              Run AI Evaluation
            </>
          )}
        </button>
      </div>

      {/* Summary cards */}
      {evaluation && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Total Score
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {evaluation.total_score} / {evaluation.total_max_score}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                <Brain size={22} style={{ color: '#3b82f6' }} />
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Questions Evaluated
                </p>
                <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-primary)' }}>
                  {questionEvaluations.length}
                </p>
              </div>
              <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle size={22} style={{ color: '#10b981' }} />
              </div>
            </div>
          </div>

          <div
            className="rounded-xl p-5"
            style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--card-shadow)',
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Risk Level
                </p>
                <p className="text-2xl font-bold mt-1 capitalize" style={{ color: 'var(--text-primary)' }}>
                  {proctoringReport?.risk_level ?? 'N/A'}
                </p>
              </div>
              <div
                className="p-3 rounded-lg"
                style={{
                  backgroundColor: proctoringReport
                    ? riskLevelConfig[proctoringReport.risk_level]?.bg ?? 'rgba(107,114,128,0.1)'
                    : 'rgba(107,114,128,0.1)',
                }}
              >
                <Shield
                  size={22}
                  style={{
                    color: proctoringReport
                      ? riskLevelConfig[proctoringReport.risk_level]?.color ?? 'var(--text-muted)'
                      : 'var(--text-muted)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Evaluating spinner overlay */}
      {evaluating && !evaluation && (
        <div
          className="rounded-xl p-12 flex flex-col items-center justify-center gap-4 mb-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <Loader2 size={40} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Running AI evaluation on candidate responses...
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            This may take a moment
          </p>
        </div>
      )}

      {/* No evaluation yet placeholder */}
      {!evaluation && !evaluating && (
        <div
          className="rounded-xl p-12 flex flex-col items-center justify-center gap-4 mb-6"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--card-shadow)',
          }}
        >
          <Brain size={48} style={{ color: 'var(--text-muted)' }} />
          <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            No evaluation results yet
          </p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Click "Run AI Evaluation" to analyze this candidate's session
          </p>
        </div>
      )}

      {evaluation && (
        <>
          {/* Skill Radar Chart + Per-question evaluations layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {/* Skill Radar Chart */}
            {radarData.length > 0 && (
              <div
                className="rounded-xl p-5 lg:col-span-1"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                  Skill Assessment
                </h2>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis
                        dataKey="skill"
                        tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        tickCount={5}
                      />
                      <Radar
                        name="Score %"
                        dataKey="score"
                        stroke="var(--accent)"
                        fill="var(--accent)"
                        fillOpacity={0.25}
                        strokeWidth={2}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'var(--card-bg)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          color: 'var(--text-primary)',
                          fontSize: 12,
                        }}
                        formatter={(value?: number) => [`${value ?? 0}%`, 'Score'] as [string, string]}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
                {/* Skill list beneath chart */}
                <div className="mt-4 space-y-2">
                  {skillScores.map((s) => {
                    const pct = s.max_score > 0 ? Math.round((s.score / s.max_score) * 100) : 0;
                    return (
                      <div key={s.skill} className="flex items-center justify-between text-sm">
                        <span style={{ color: 'var(--text-secondary)' }}>{s.skill}</span>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                          {s.score}/{s.max_score} ({pct}%)
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Per-question AI Evaluations */}
            <div className={radarData.length > 0 ? 'lg:col-span-2' : 'lg:col-span-3'}>
              <div
                className="rounded-xl overflow-hidden"
                style={{
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--card-shadow)',
                }}
              >
                <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Per-Question Evaluation
                  </h2>
                </div>

                {questionEvaluations.length === 0 ? (
                  <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                    No per-question evaluations available
                  </div>
                ) : (
                  <div>
                    {questionEvaluations.map((qe, idx) => {
                      const qId = qe.question_id || `q-${idx}`;
                      const isExpanded = expandedQuestions.has(qId);
                      const scorePct = qe.max_score > 0 ? Math.round((qe.score / qe.max_score) * 100) : 0;

                      return (
                        <div
                          key={qId}
                          style={{ borderBottom: '1px solid var(--border)' }}
                        >
                          {/* Collapsed header */}
                          <button
                            onClick={() => toggleQuestion(qId)}
                            className="w-full flex items-center gap-3 px-5 py-4 text-left"
                            style={{ backgroundColor: 'transparent' }}
                          >
                            <span
                              className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{
                                backgroundColor: 'var(--bg-secondary)',
                                color: 'var(--text-secondary)',
                              }}
                            >
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                                {qe.question_title || `Question ${idx + 1}`}
                              </p>
                              {qe.question_type && (
                                <span
                                  className="text-xs capitalize"
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  {qe.question_type.replace('_', ' ')}
                                </span>
                              )}
                            </div>
                            {/* Score badge */}
                            <span
                              className="flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                backgroundColor:
                                  scorePct >= 70
                                    ? 'rgba(16,185,129,0.12)'
                                    : scorePct >= 40
                                      ? 'rgba(245,158,11,0.12)'
                                      : 'rgba(239,68,68,0.12)',
                                color:
                                  scorePct >= 70
                                    ? 'var(--success)'
                                    : scorePct >= 40
                                      ? 'var(--warning)'
                                      : 'var(--danger)',
                              }}
                            >
                              {qe.score}/{qe.max_score}
                            </span>
                            {isExpanded ? (
                              <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                            ) : (
                              <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                            )}
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div
                              className="px-5 pb-5"
                              style={{ borderTop: '1px solid var(--border)' }}
                            >
                              {/* AI Feedback */}
                              <div className="mt-4">
                                <div className="flex items-center gap-2 mb-2">
                                  <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
                                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                    AI Feedback
                                  </p>
                                </div>
                                <p
                                  className="text-sm leading-relaxed rounded-lg p-3"
                                  style={{
                                    color: 'var(--text-primary)',
                                    backgroundColor: 'var(--bg-secondary)',
                                  }}
                                >
                                  {qe.feedback || 'No feedback provided.'}
                                </p>
                              </div>

                              {/* Strengths & Weaknesses */}
                              {(qe.strengths?.length || qe.weaknesses?.length) && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                                  {qe.strengths && qe.strengths.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--success)' }}>
                                        Strengths
                                      </p>
                                      <ul className="space-y-1">
                                        {qe.strengths.map((s, si) => (
                                          <li key={si} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            <CheckCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--success)' }} />
                                            {s}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                  {qe.weaknesses && qe.weaknesses.length > 0 && (
                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--danger)' }}>
                                        Areas for Improvement
                                      </p>
                                      <ul className="space-y-1">
                                        {qe.weaknesses.map((w, wi) => (
                                          <li key={wi} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                                            <XCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--danger)' }} />
                                            {w}
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Code Execution Results */}
                              {qe.code_execution && (
                                <div className="mt-4">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Code size={14} style={{ color: 'var(--accent)' }} />
                                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                                      Code Execution Results
                                    </p>
                                    <span
                                      className="ml-auto text-xs font-medium px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor:
                                          qe.code_execution.total_passed === qe.code_execution.total_cases
                                            ? 'rgba(16,185,129,0.12)'
                                            : 'rgba(239,68,68,0.12)',
                                        color:
                                          qe.code_execution.total_passed === qe.code_execution.total_cases
                                            ? 'var(--success)'
                                            : 'var(--danger)',
                                      }}
                                    >
                                      {qe.code_execution.total_passed}/{qe.code_execution.total_cases} passed
                                    </span>
                                  </div>
                                  <div
                                    className="rounded-lg overflow-hidden"
                                    style={{ border: '1px solid var(--border)' }}
                                  >
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                                          {['#', 'Input', 'Expected', 'Actual', 'Status'].map((h) => (
                                            <th
                                              key={h}
                                              className="text-left px-3 py-2 text-xs font-semibold uppercase"
                                              style={{ color: 'var(--text-muted)' }}
                                            >
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {qe.code_execution.test_cases.map((tc, tci) => (
                                          <tr key={tci} style={{ borderTop: '1px solid var(--border)' }}>
                                            <td className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                                              {tci + 1}
                                              {tc.is_hidden && (
                                                <span
                                                  className="ml-1 px-1 py-0.5 rounded text-[10px]"
                                                  style={{
                                                    backgroundColor: 'var(--bg-secondary)',
                                                    color: 'var(--text-muted)',
                                                  }}
                                                >
                                                  hidden
                                                </span>
                                              )}
                                            </td>
                                            <td
                                              className="px-3 py-2 font-mono text-xs max-w-[160px] truncate"
                                              style={{ color: 'var(--text-secondary)' }}
                                            >
                                              {tc.input}
                                            </td>
                                            <td
                                              className="px-3 py-2 font-mono text-xs max-w-[160px] truncate"
                                              style={{ color: 'var(--text-secondary)' }}
                                            >
                                              {tc.expected_output}
                                            </td>
                                            <td
                                              className="px-3 py-2 font-mono text-xs max-w-[160px] truncate"
                                              style={{ color: 'var(--text-secondary)' }}
                                            >
                                              {tc.actual_output}
                                            </td>
                                            <td className="px-3 py-2">
                                              {tc.passed ? (
                                                <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                                              ) : (
                                                <XCircle size={16} style={{ color: 'var(--danger)' }} />
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Proctoring Report */}
          {proctoringReport && (
            <div
              className="rounded-xl overflow-hidden mb-6"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--card-shadow)',
              }}
            >
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3">
                  <Shield size={18} style={{ color: 'var(--text-primary)' }} />
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Proctoring Report
                  </h2>
                </div>
                <span
                  className="px-3 py-1 rounded-full text-xs font-semibold capitalize"
                  style={{
                    backgroundColor: riskLevelConfig[proctoringReport.risk_level]?.bg ?? 'rgba(107,114,128,0.1)',
                    color: riskLevelConfig[proctoringReport.risk_level]?.color ?? 'var(--text-muted)',
                  }}
                >
                  {riskLevelConfig[proctoringReport.risk_level]?.label ?? proctoringReport.risk_level}
                </span>
              </div>

              <div className="p-5">
                {/* Summary */}
                {proctoringReport.summary && (
                  <p className="text-sm mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {proctoringReport.summary}
                  </p>
                )}

                {/* Findings */}
                {proctoringReport.findings && proctoringReport.findings.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                      Findings ({proctoringReport.findings.length})
                    </p>
                    <div className="space-y-2">
                      {proctoringReport.findings.map((finding, fi) => {
                        const severityColor =
                          finding.severity === 'high' || finding.severity === 'critical'
                            ? 'var(--danger)'
                            : finding.severity === 'medium'
                              ? 'var(--warning)'
                              : 'var(--text-muted)';
                        return (
                          <div
                            key={fi}
                            className="flex items-start gap-3 p-3 rounded-lg"
                            style={{ backgroundColor: 'var(--bg-secondary)' }}
                          >
                            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: severityColor }} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                  {finding.type.replace(/_/g, ' ')}
                                </p>
                                {finding.severity && (
                                  <span
                                    className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded"
                                    style={{
                                      color: severityColor,
                                      backgroundColor:
                                        finding.severity === 'high' || finding.severity === 'critical'
                                          ? 'rgba(239,68,68,0.1)'
                                          : finding.severity === 'medium'
                                            ? 'rgba(245,158,11,0.1)'
                                            : 'rgba(107,114,128,0.1)',
                                    }}
                                  >
                                    {finding.severity}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                {finding.description}
                              </p>
                              {finding.timestamp && (
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                                  {new Date(finding.timestamp).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recommendation */}
                {proctoringReport.recommendation && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                      Recommendation
                    </p>
                    <div
                      className="p-3 rounded-lg text-sm leading-relaxed"
                      style={{
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        borderLeft: `3px solid ${riskLevelConfig[proctoringReport.risk_level]?.color ?? 'var(--accent)'}`,
                      }}
                    >
                      {proctoringReport.recommendation}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Advanced AI Tabs */}
      {sessionId && (
        <div className="mt-6">
          <div className="flex items-center gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            {[
              { key: 'evaluation' as const, label: 'Evaluation', icon: <Brain size={14} /> },
              { key: 'playback' as const, label: 'Code Playback', icon: <Activity size={14} /> },
              { key: 'insights' as const, label: 'AI Insights', icon: <Sparkles size={14} /> },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-colors"
                style={{
                  backgroundColor: activeTab === tab.key ? 'var(--card-bg)' : 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow: activeTab === tab.key ? 'var(--card-shadow)' : 'none',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'playback' && (
            <div>
              {session?.responses && session.responses.length > 0 ? (
                <div className="space-y-4">
                  {/* Question selector for playback */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Select Question:</span>
                    <select
                      value={selectedQuestionForPlayback}
                      onChange={(e) => setSelectedQuestionForPlayback(e.target.value)}
                      className="px-3 py-1.5 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Choose a question...</option>
                      {session.responses
                        .filter((r: { question_id: string }) => r.question_id)
                        .map((r: { question_id: string; question_title?: string }, i: number) => (
                          <option key={r.question_id} value={r.question_id}>
                            Q{i + 1}: {r.question_title || r.question_id}
                          </option>
                        ))}
                    </select>
                  </div>
                  {selectedQuestionForPlayback && (
                    <CodePlaybackViewer
                      sessionId={sessionId}
                      questionId={selectedQuestionForPlayback}
                    />
                  )}
                </div>
              ) : (
                <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
                  <Activity size={32} className="mx-auto mb-2 opacity-40" style={{ color: 'var(--text-muted)' }} />
                  <p style={{ color: 'var(--text-muted)' }}>No code responses available for playback</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'insights' && (
            <CandidateInsights sessionId={sessionId} />
          )}
        </div>
      )}
    </div>
  );
}
