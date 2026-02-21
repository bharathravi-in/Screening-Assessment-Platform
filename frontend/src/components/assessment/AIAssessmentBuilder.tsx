import { useState } from 'react';
import { X, Zap, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiService } from '../../services/aiService';

interface AIAssessmentBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onBlueprintReady: (blueprint: Record<string, unknown>) => void;
}

export default function AIAssessmentBuilder({
  isOpen,
  onClose,
  onBlueprintReady,
}: AIAssessmentBuilderProps) {
  const [jobDescription, setJobDescription] = useState('');
  const [questionCount, setQuestionCount] = useState(20);
  const [timeLimit, setTimeLimit] = useState(60);
  const [building, setBuilding] = useState(false);
  const [blueprint, setBlueprint] = useState<Record<string, unknown> | null>(null);

  if (!isOpen) return null;

  const handleBuild = async () => {
    if (!jobDescription.trim()) {
      toast.error('Please enter a job description');
      return;
    }
    setBuilding(true);
    setBlueprint(null);
    try {
      const result = await aiService.buildAssessment(
        jobDescription,
        questionCount,
        timeLimit
      );
      setBlueprint(result.blueprint);
      toast.success('Assessment blueprint generated');
    } catch {
      toast.error('Failed to generate assessment');
    }
    setBuilding(false);
  };

  const inputStyle = {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border)',
  };

  const bp = blueprint as Record<string, unknown> | null;
  const sections = (bp?.sections as Array<Record<string, unknown>>) || [];
  const jdAnalysis = (bp?.jd_analysis as Record<string, unknown>) || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{ backgroundColor: 'var(--bg-primary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Zap size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Assessment Builder
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Job Description */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Job Description
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={8}
              placeholder="Paste the full job description here..."
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-y"
              style={inputStyle}
            />
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Questions
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={questionCount}
                onChange={(e) => setQuestionCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Time Limit (minutes)
              </label>
              <input
                type="number"
                min={15}
                max={240}
                value={timeLimit}
                onChange={(e) => setTimeLimit(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Build Button */}
          <button
            onClick={handleBuild}
            disabled={building || !jobDescription.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {building ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            {building ? 'Building...' : 'Build Assessment'}
          </button>

          {/* Blueprint Preview */}
          {bp && (
            <div className="space-y-4">
              {/* JD Analysis */}
              {jdAnalysis && (
                <div
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                >
                  <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Job Analysis
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {(jdAnalysis.job_title as string) || 'N/A'} - {(jdAnalysis.seniority_level as string) || 'N/A'}
                  </p>
                  {(jdAnalysis.required_skills as Array<Record<string, string>>)?.map((s, i) => (
                    <span
                      key={i}
                      className="inline-block px-2 py-0.5 rounded text-xs mr-1 mt-1"
                      style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: s.importance === 'critical' ? 1 : 0.7 }}
                    >
                      {s.skill}
                    </span>
                  ))}
                </div>
              )}

              {/* Sections */}
              <div
                className="rounded-lg border p-4"
                style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              >
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                  Assessment: {(bp.title as string) || 'Untitled'}
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
                  {(bp.description as string) || ''}
                </p>
                {sections.map((section, i) => (
                  <div key={i} className="mb-3">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      Section {i + 1}: {(section.title as string) || ''}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {((section.questions as unknown[]) || []).length} questions
                    </p>
                  </div>
                ))}
              </div>

              {/* Create Button */}
              <button
                onClick={() => onBlueprintReady(bp)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: 'var(--success)', color: '#fff' }}
              >
                Create Assessment from Blueprint
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
