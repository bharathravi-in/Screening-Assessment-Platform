import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Save,
  ArrowLeft,
  Plus,
  Trash2,
  Search,
  GripVertical,
  Send,
  FileText,
  Settings,
  Mail,
  ListChecks,
  Info,
  Clock,
  Filter,
  Sparkles,
} from 'lucide-react';
import { assessmentService } from '../../services/assessmentService';
import type { AssessmentCreateData } from '../../services/assessmentService';
import { questionService } from '../../services/questionService';
import { candidateService } from '../../services/candidateService';
import { aiService } from '../../services/aiService';
import AIAssessmentBuilder from '../../components/assessment/AIAssessmentBuilder';
import type {
  AssessmentDetail,
  AssessmentQuestion,
  CandidateInvitation,
  InvitationStatus,
} from '../../types/assessment';
import type { Question, QuestionType, DifficultyLevel } from '../../types/question';

type TabKey = 'basic' | 'questions' | 'settings' | 'invitations';

const TABS: { key: TabKey; label: string; icon: typeof Info; editOnly?: boolean }[] = [
  { key: 'basic', label: 'Basic Info', icon: Info },
  { key: 'questions', label: 'Questions', icon: ListChecks },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'invitations', label: 'Invitations', icon: Mail, editOnly: true },
];

const QUESTION_TYPES: QuestionType[] = [
  'mcq',
  'multi_select',
  'short_answer',
  'debugging',
  'code_completion',
  'coding',
  'system_design',
  'scenario',
];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border)',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'var(--card-bg)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow)',
};

function getTypeBadgeColor(type: QuestionType): string {
  const colors: Record<QuestionType, string> = {
    mcq: '#3b82f6',
    multi_select: '#6366f1',
    short_answer: '#8b5cf6',
    debugging: '#ef4444',
    code_completion: '#f59e0b',
    coding: '#10b981',
    system_design: '#ec4899',
    scenario: '#14b8a6',
  };
  return colors[type] || '#6b7280';
}

function getDifficultyBadgeColor(difficulty: DifficultyLevel): string {
  const colors: Record<DifficultyLevel, string> = {
    beginner: '#10b981',
    intermediate: '#f59e0b',
    advanced: '#ef4444',
    expert: '#7c3aed',
  };
  return colors[difficulty] || '#6b7280';
}

function formatLabel(value: string): string {
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getInvitationStatusColor(status: InvitationStatus): string {
  const map: Record<InvitationStatus, string> = {
    pending: 'var(--warning)',
    sent: 'var(--accent)',
    opened: '#6366f1',
    started: '#f59e0b',
    completed: 'var(--success)',
    expired: 'var(--text-muted)',
    cancelled: 'var(--danger)',
  };
  return map[status] || 'var(--text-muted)';
}

export default function AssessmentFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);

  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Basic Info state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState<number | ''>('');
  const [passingScorePct, setPassingScorePct] = useState<number>(50);
  const [maxAttempts, setMaxAttempts] = useState<number>(1);

  // Settings state
  const [isRandomized, setIsRandomized] = useState(false);
  const [isAdaptive, setIsAdaptive] = useState(false);
  const [showScoreImmediately, setShowScoreImmediately] = useState(false);
  const [copyPasteDisabled, setCopyPasteDisabled] = useState(false);
  const [tabSwitchDetection, setTabSwitchDetection] = useState(false);
  const [fullscreenEnforced, setFullscreenEnforced] = useState(false);
  const [rightClickDisabled, setRightClickDisabled] = useState(false);
  const [keyboardShortcutsRestricted, setKeyboardShortcutsRestricted] = useState(false);
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');

  // Questions state
  const [availableQuestions, setAvailableQuestions] = useState<Question[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<AssessmentQuestion[]>([]);
  const [questionSearch, setQuestionSearch] = useState('');
  const [questionTypeFilter, setQuestionTypeFilter] = useState('');
  const [questionsLoading, setQuestionsLoading] = useState(false);

  // Invitations state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitations, setInvitations] = useState<CandidateInvitation[]>([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);

  // AI Builder modal
  const [showAIBuilder, setShowAIBuilder] = useState(false);

  // AI Question Generator state
  const [showAIQGen, setShowAIQGen] = useState(false);
  const [aiQSkills, setAiQSkills] = useState('');
  const [aiQDifficulty, setAiQDifficulty] = useState('intermediate');
  const [aiQType, setAiQType] = useState('mcq');
  const [aiQCount, setAiQCount] = useState(5);
  const [aiQLoading, setAiQLoading] = useState(false);

  // Load assessment data in edit mode
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    assessmentService
      .getAssessment(id)
      .then((data: AssessmentDetail) => {
        setTitle(data.title);
        setDescription(data.description || '');
        setInstructions(data.instructions || '');
        setTimeLimitMinutes(data.time_limit_minutes ?? '');
        setPassingScorePct(data.passing_score_pct);
        setMaxAttempts(data.max_attempts);
        setIsRandomized(data.is_randomized);
        setIsAdaptive(data.is_adaptive);
        setShowScoreImmediately(data.show_score_immediately);
        setScheduledStart(data.scheduled_start || '');
        setScheduledEnd(data.scheduled_end || '');
        setSelectedQuestions(
          [...data.assessment_questions].sort((a, b) => a.order_index - b.order_index)
        );

        const pc = data.proctoring_config as Record<string, boolean> | null;
        if (pc) {
          setCopyPasteDisabled(!!pc.copy_paste_disabled);
          setTabSwitchDetection(!!pc.tab_switch_detection);
          setFullscreenEnforced(!!pc.fullscreen_enforced);
          setRightClickDisabled(!!pc.right_click_disabled);
          setKeyboardShortcutsRestricted(!!pc.keyboard_shortcuts_restricted);
        }
      })
      .catch(() => {
        toast.error('Failed to load assessment');
        navigate('/hr/assessments');
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  // Load available questions
  const loadAvailableQuestions = useCallback(() => {
    setQuestionsLoading(true);
    questionService
      .getQuestions({
        search: questionSearch || undefined,
        type: questionTypeFilter || undefined,
        page_size: 100,
        is_active: true,
      })
      .then((res) => setAvailableQuestions(res.questions))
      .catch(() => toast.error('Failed to load questions'))
      .finally(() => setQuestionsLoading(false));
  }, [questionSearch, questionTypeFilter]);

  useEffect(() => {
    if (activeTab === 'questions') {
      loadAvailableQuestions();
    }
  }, [activeTab, loadAvailableQuestions]);

  // Load invitations
  useEffect(() => {
    if (activeTab === 'invitations' && id) {
      setInvitationsLoading(true);
      candidateService
        .getInvitations({ assessment_id: id, page_size: 100 })
        .then((res) => setInvitations(res.invitations))
        .catch(() => toast.error('Failed to load invitations'))
        .finally(() => setInvitationsLoading(false));
    }
  }, [activeTab, id]);

  const buildFormData = (): AssessmentCreateData => {
    const data: AssessmentCreateData = {
      title: title.trim(),
      description: description.trim() || undefined,
      instructions: instructions.trim() || undefined,
      time_limit_minutes: timeLimitMinutes !== '' ? Number(timeLimitMinutes) : undefined,
      passing_score_pct: passingScorePct,
      max_attempts: maxAttempts,
      is_randomized: isRandomized,
      is_adaptive: isAdaptive,
      show_score_immediately: showScoreImmediately,
      proctoring_config: {
        copy_paste_disabled: copyPasteDisabled,
        tab_switch_detection: tabSwitchDetection,
        fullscreen_enforced: fullscreenEnforced,
        right_click_disabled: rightClickDisabled,
        keyboard_shortcuts_restricted: keyboardShortcutsRestricted,
      },
      scheduled_start: scheduledStart || undefined,
      scheduled_end: scheduledEnd || undefined,
    };
    return data;
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Title is required');
      setActiveTab('basic');
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        await assessmentService.updateAssessment(id, buildFormData());
        toast.success('Assessment updated successfully');
      } else {
        const created = await assessmentService.createAssessment(buildFormData());
        toast.success('Assessment created successfully');
        navigate(`/hr/assessments/${created.id}/edit`);
      }
    } catch {
      toast.error(isEditMode ? 'Failed to update assessment' : 'Failed to create assessment');
    } finally {
      setSaving(false);
    }
  };

  const handleAddQuestion = async (question: Question) => {
    if (!id) {
      toast.error('Please save the assessment first before adding questions');
      return;
    }

    try {
      const aq = await assessmentService.addQuestion(id, {
        question_id: question.id,
        order_index: selectedQuestions.length,
      });
      setSelectedQuestions((prev) => [...prev, aq]);
      toast.success('Question added');
    } catch {
      toast.error('Failed to add question');
    }
  };

  const handleRemoveQuestion = async (aq: AssessmentQuestion) => {
    if (!id) return;

    try {
      await assessmentService.removeQuestion(id, aq.id);
      setSelectedQuestions((prev) => prev.filter((q) => q.id !== aq.id));
      toast.success('Question removed');
    } catch {
      toast.error('Failed to remove question');
    }
  };

  const handleSendInvite = async () => {
    if (!id) return;
    if (!inviteEmail.trim()) {
      toast.error('Email is required');
      return;
    }
    if (!inviteName.trim()) {
      toast.error('Name is required');
      return;
    }

    setSendingInvite(true);
    try {
      const invitation = await candidateService.inviteCandidate({
        assessment_id: id,
        candidate_email: inviteEmail.trim(),
        candidate_name: inviteName.trim(),
      });
      setInvitations((prev) => [invitation, ...prev]);
      setInviteEmail('');
      setInviteName('');
      toast.success('Invitation sent successfully');
    } catch {
      toast.error('Failed to send invitation');
    } finally {
      setSendingInvite(false);
    }
  };

  const selectedQuestionIds = new Set(selectedQuestions.map((aq) => aq.question_id));

  const filteredAvailableQuestions = availableQuestions.filter(
    (q) => !selectedQuestionIds.has(q.id)
  );

  // AI Generate & Save Questions handler
  const handleAIGenerateAndSave = async () => {
    const skills = aiQSkills.split(',').map((s) => s.trim()).filter(Boolean);
    if (skills.length === 0) {
      toast.error('Enter at least one skill');
      return;
    }
    setAiQLoading(true);
    try {
      const result = await aiService.generateAndSaveQuestions(
        skills,
        aiQDifficulty,
        aiQType,
        aiQCount
      );
      toast.success(`Generated & saved ${result.count} questions to the question bank!`);
      setShowAIQGen(false);
      setAiQSkills('');
      loadAvailableQuestions();
    } catch {
      toast.error('Failed to generate questions');
    } finally {
      setAiQLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--accent)' }}
        />
      </div>
    );
  }

  const renderBasicInfoTab = () => (
    <div className="space-y-5">
      {/* Title */}
      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Title <span style={{ color: 'var(--danger)' }}>*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter assessment title"
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
          style={{
            ...inputStyle,
            focusRingColor: 'var(--accent)',
          } as React.CSSProperties}
        />
      </div>

      {/* Description */}
      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the purpose of this assessment"
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-vertical"
          style={inputStyle}
        />
      </div>

      {/* Instructions */}
      <div>
        <label
          className="block text-sm font-medium mb-1.5"
          style={{ color: 'var(--text-secondary)' }}
        >
          Instructions
        </label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Instructions displayed to candidates before starting"
          rows={4}
          className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 resize-vertical"
          style={inputStyle}
        />
      </div>

      {/* Number fields row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Clock size={14} className="inline mr-1" />
            Time Limit (minutes)
          </label>
          <input
            type="number"
            value={timeLimitMinutes}
            onChange={(e) =>
              setTimeLimitMinutes(e.target.value === '' ? '' : Number(e.target.value))
            }
            placeholder="No limit"
            min={1}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Passing Score (%)
          </label>
          <input
            type="number"
            value={passingScorePct}
            onChange={(e) => setPassingScorePct(Number(e.target.value))}
            min={0}
            max={100}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          />
        </div>

        <div>
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'var(--text-secondary)' }}
          >
            Max Attempts
          </label>
          <input
            type="number"
            value={maxAttempts}
            onChange={(e) => setMaxAttempts(Number(e.target.value))}
            min={1}
            className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );

  const renderQuestionsTab = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left Panel: Available Questions */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Available Questions
        </h3>

        {/* AI Generate Button */}
        <button
          onClick={() => setShowAIQGen(true)}
          className="w-full flex items-center justify-center gap-2 mb-3 px-3 py-2 rounded-lg text-white text-sm font-medium transition-all hover:shadow-lg"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
        >
          <Sparkles size={14} />
          AI Generate Questions
        </button>

        {/* AI Question Generator Dialog */}
        {showAIQGen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                  <Sparkles size={20} style={{ color: '#8b5cf6' }} />
                  AI Question Generator
                </h2>
                <button onClick={() => setShowAIQGen(false)} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
                  <span className="sr-only">Close</span>✕
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Skills (comma-separated)</label>
                  <input type="text" value={aiQSkills} onChange={(e) => setAiQSkills(e.target.value)} placeholder="e.g. React, TypeScript, REST APIs" className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Difficulty</label>
                    <select value={aiQDifficulty} onChange={(e) => setAiQDifficulty(e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm" style={inputStyle}>
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                      <option value="expert">Expert</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Type</label>
                    <select value={aiQType} onChange={(e) => setAiQType(e.target.value)} className="w-full px-2 py-2 rounded-lg text-sm" style={inputStyle}>
                      {QUESTION_TYPES.map((t) => <option key={t} value={t}>{formatLabel(t)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Count</label>
                    <input type="number" min={1} max={10} value={aiQCount} onChange={(e) => setAiQCount(Number(e.target.value))} className="w-full px-2 py-2 rounded-lg text-sm text-center" style={inputStyle} />
                  </div>
                </div>
              </div>

              <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Questions will be generated by AI and saved to your question bank.</p>

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowAIQGen(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                <button onClick={handleAIGenerateAndSave} disabled={aiQLoading || !aiQSkills.trim()} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  {aiQLoading ? <span className="animate-spin">⟳</span> : <Sparkles size={14} />}
                  Generate & Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <input
              type="text"
              value={questionSearch}
              onChange={(e) => setQuestionSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div className="relative">
            <Filter
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2"
              style={{ color: 'var(--text-muted)' }}
            />
            <select
              value={questionTypeFilter}
              onChange={(e) => setQuestionTypeFilter(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 appearance-none cursor-pointer"
              style={inputStyle}
            >
              <option value="">All Types</option>
              {QUESTION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {formatLabel(t)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Question List */}
        <div
          className="space-y-2 overflow-y-auto pr-1"
          style={{ maxHeight: '480px' }}
        >
          {questionsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div
                className="animate-spin rounded-full h-5 w-5 border-b-2"
                style={{ borderColor: 'var(--accent)' }}
              />
            </div>
          ) : filteredAvailableQuestions.length === 0 ? (
            <p
              className="text-sm text-center py-8"
              style={{ color: 'var(--text-muted)' }}
            >
              No questions available
            </p>
          ) : (
            filteredAvailableQuestions.map((question) => (
              <div
                key={question.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex-1 min-w-0 mr-3">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {question.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getTypeBadgeColor(question.type)}20`,
                        color: getTypeBadgeColor(question.type),
                      }}
                    >
                      {formatLabel(question.type)}
                    </span>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getDifficultyBadgeColor(question.difficulty)}20`,
                        color: getDifficultyBadgeColor(question.difficulty),
                      }}
                    >
                      {formatLabel(question.difficulty)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleAddQuestion(question)}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                  }}
                  title="Add question"
                >
                  <Plus size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel: Selected Questions */}
      <div className="rounded-xl p-4" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--text-primary)' }}
        >
          Selected Questions ({selectedQuestions.length})
        </h3>

        <div
          className="space-y-2 overflow-y-auto pr-1"
          style={{ maxHeight: '530px' }}
        >
          {selectedQuestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileText
                size={32}
                className="mb-2"
                style={{ color: 'var(--text-muted)' }}
              />
              <p
                className="text-sm text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                No questions added yet.
                <br />
                Add questions from the left panel.
              </p>
            </div>
          ) : (
            selectedQuestions.map((aq, index) => (
              <div
                key={aq.id}
                className="flex items-center gap-3 p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <GripVertical
                  size={16}
                  className="flex-shrink-0 cursor-grab"
                  style={{ color: 'var(--text-muted)' }}
                />
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: '#fff',
                  }}
                >
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {aq.question.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getTypeBadgeColor(aq.question.type)}20`,
                        color: getTypeBadgeColor(aq.question.type),
                      }}
                    >
                      {formatLabel(aq.question.type)}
                    </span>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${getDifficultyBadgeColor(aq.question.difficulty)}20`,
                        color: getDifficultyBadgeColor(aq.question.difficulty),
                      }}
                    >
                      {formatLabel(aq.question.difficulty)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemoveQuestion(aq)}
                  className="p-1.5 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                  style={{ color: 'var(--danger)' }}
                  title="Remove question"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  const renderSettingsTab = () => (
    <div className="space-y-6">
      {/* General Settings */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          General Settings
        </h3>
        <div className="space-y-3">
          {[
            {
              label: 'Randomize Questions',
              description: 'Shuffle question order for each candidate',
              checked: isRandomized,
              onChange: setIsRandomized,
            },
            {
              label: 'Adaptive Testing',
              description: 'Adjust question difficulty based on responses',
              checked: isAdaptive,
              onChange: setIsAdaptive,
            },
            {
              label: 'Show Score Immediately',
              description: 'Display score to candidate upon completion',
              checked: showScoreImmediately,
              onChange: setShowScoreImmediately,
            },
          ].map((setting) => (
            <label
              key={setting.label}
              className="flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <input
                type="checkbox"
                checked={setting.checked}
                onChange={(e) => setting.onChange(e.target.checked)}
                className="mt-0.5 rounded cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {setting.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {setting.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Proctoring Config */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Proctoring Configuration
        </h3>
        <div className="space-y-3">
          {[
            {
              label: 'Copy/Paste Disabled',
              description: 'Prevent candidates from copying or pasting content',
              checked: copyPasteDisabled,
              onChange: setCopyPasteDisabled,
            },
            {
              label: 'Tab Switch Detection',
              description: 'Detect when candidates switch browser tabs',
              checked: tabSwitchDetection,
              onChange: setTabSwitchDetection,
            },
            {
              label: 'Fullscreen Enforced',
              description: 'Require fullscreen mode during the assessment',
              checked: fullscreenEnforced,
              onChange: setFullscreenEnforced,
            },
            {
              label: 'Right Click Disabled',
              description: 'Disable right-click context menu',
              checked: rightClickDisabled,
              onChange: setRightClickDisabled,
            },
            {
              label: 'Keyboard Shortcuts Restricted',
              description: 'Block common keyboard shortcuts',
              checked: keyboardShortcutsRestricted,
              onChange: setKeyboardShortcutsRestricted,
            },
          ].map((setting) => (
            <label
              key={setting.label}
              className="flex items-start gap-3 cursor-pointer p-3 rounded-lg transition-colors"
              style={{ backgroundColor: 'var(--bg-secondary)' }}
            >
              <input
                type="checkbox"
                checked={setting.checked}
                onChange={(e) => setting.onChange(e.target.checked)}
                className="mt-0.5 rounded cursor-pointer"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div>
                <p
                  className="text-sm font-medium"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {setting.label}
                </p>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {setting.description}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Schedule
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Scheduled Start
            </label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={(e) => setScheduledStart(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-secondary)' }}
            >
              Scheduled End
            </label>
            <input
              type="datetime-local"
              value={scheduledEnd}
              onChange={(e) => setScheduledEnd(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderInvitationsTab = () => (
    <div className="space-y-5">
      {/* Send Invite Form */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Send Invitation
        </h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="candidate@example.com"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div className="flex-1">
            <label
              className="block text-xs font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Name
            </label>
            <input
              type="text"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              placeholder="Candidate Name"
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2"
              style={inputStyle}
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={handleSendInvite}
              disabled={sendingInvite}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
              style={{
                backgroundColor: 'var(--accent)',
                color: '#fff',
              }}
            >
              <Send size={14} />
              {sendingInvite ? 'Sending...' : 'Send Invite'}
            </button>
          </div>
        </div>
      </div>

      {/* Invitations List */}
      <div className="rounded-xl p-5" style={cardStyle}>
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Invitations ({invitations.length})
        </h3>

        {invitationsLoading ? (
          <div className="flex items-center justify-center py-8">
            <div
              className="animate-spin rounded-full h-5 w-5 border-b-2"
              style={{ borderColor: 'var(--accent)' }}
            />
          </div>
        ) : invitations.length === 0 ? (
          <p
            className="text-sm text-center py-8"
            style={{ color: 'var(--text-muted)' }}
          >
            No invitations sent yet.
          </p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {inv.candidate_name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {inv.candidate_email}
                  </p>
                </div>
                <span
                  className="inline-block px-2.5 py-1 rounded-full text-xs font-medium flex-shrink-0 ml-3"
                  style={{
                    backgroundColor: `${getInvitationStatusColor(inv.status)}20`,
                    color: getInvitationStatusColor(inv.status),
                  }}
                >
                  {formatLabel(inv.status)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'basic':
        return renderBasicInfoTab();
      case 'questions':
        return renderQuestionsTab();
      case 'settings':
        return renderSettingsTab();
      case 'invitations':
        return renderInvitationsTab();
      default:
        return null;
    }
  };

  const visibleTabs = TABS.filter((tab) => !tab.editOnly || isEditMode);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/hr/assessments')}
            className="p-2 rounded-lg transition-colors cursor-pointer"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
            title="Back to assessments"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1
              className="text-xl font-bold"
              style={{ color: 'var(--text-primary)' }}
            >
              {isEditMode ? 'Edit Assessment' : 'Create Assessment'}
            </h1>
            {isEditMode && title && (
              <p
                className="text-sm mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                {title}
              </p>
            )}
          </div>
        </div>
        {!isEditMode && (
          <button
            onClick={() => setShowAIBuilder(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer"
            style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
          >
            <Sparkles size={16} />
            AI Build from JD
          </button>
        )}
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {visibleTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer flex-1 justify-center"
              style={{
                backgroundColor: isActive ? 'var(--card-bg)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: isActive ? 'var(--card-shadow)' : 'none',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="mb-6">{renderTabContent()}</div>

      {/* Save Button */}
      <div
        className="flex justify-end pt-4"
        style={{ borderTop: '1px solid var(--border)' }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
          style={{
            backgroundColor: 'var(--accent)',
            color: '#fff',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent-hover)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--accent)';
          }}
        >
          <Save size={16} />
          {saving ? 'Saving...' : isEditMode ? 'Update Assessment' : 'Create Assessment'}
        </button>
      </div>

      {/* AI Assessment Builder Modal */}
      {showAIBuilder && (
        <AIAssessmentBuilder
          isOpen={showAIBuilder}
          onClose={() => setShowAIBuilder(false)}
          onBlueprintReady={(blueprint) => {
            setShowAIBuilder(false);
            if (blueprint.title) setTitle(blueprint.title as string);
            if (blueprint.description) setDescription(blueprint.description as string);
            if (blueprint.instructions) setInstructions(blueprint.instructions as string);
            if (blueprint.time_limit_minutes) setTimeLimitMinutes(blueprint.time_limit_minutes as number);
            if (blueprint.passing_score_pct) setPassingScorePct(blueprint.passing_score_pct as number);
            toast.success('Assessment blueprint applied! Review and save.');
          }}
        />
      )}
    </div>
  );
}
