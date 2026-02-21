import { useState } from 'react';
import { X, Wand2, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { aiService } from '../../services/aiService';
import type { AIGeneratedQuestion } from '../../services/aiService';

interface AIQuestionGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onAddToBank: (question: AIGeneratedQuestion) => void;
  availableSkills: string[];
}

const QUESTION_TYPES = [
  { value: 'mcq', label: 'Multiple Choice' },
  { value: 'multi_select', label: 'Multi Select' },
  { value: 'short_answer', label: 'Short Answer' },
  { value: 'coding', label: 'Coding' },
  { value: 'debugging', label: 'Debugging' },
  { value: 'code_completion', label: 'Code Completion' },
  { value: 'system_design', label: 'System Design' },
  { value: 'scenario', label: 'Scenario' },
];

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'expert'];

export default function AIQuestionGenerator({
  isOpen,
  onClose,
  onAddToBank,
  availableSkills,
}: AIQuestionGeneratorProps) {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [difficulty, setDifficulty] = useState('intermediate');
  const [questionType, setQuestionType] = useState('mcq');
  const [count, setCount] = useState(3);
  const [generating, setGenerating] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<AIGeneratedQuestion[]>([]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (selectedSkills.length === 0) {
      toast.error('Select at least one skill');
      return;
    }
    setGenerating(true);
    setGeneratedQuestions([]);
    try {
      const result = await aiService.generateQuestions(
        selectedSkills,
        difficulty,
        questionType,
        count
      );
      setGeneratedQuestions(result.questions);
      toast.success(`Generated ${result.count} question(s)`);
    } catch {
      toast.error('Failed to generate questions');
    }
    setGenerating(false);
  };

  const handleAddSkill = () => {
    const skill = skillInput.trim();
    if (skill && !selectedSkills.includes(skill)) {
      setSelectedSkills([...selectedSkills, skill]);
      setSkillInput('');
    }
  };

  const filteredSuggestions = availableSkills.filter(
    (s) => s.toLowerCase().includes(skillInput.toLowerCase()) && !selectedSkills.includes(s)
  ).slice(0, 5);

  const inputStyle = {
    backgroundColor: 'var(--card-bg)',
    color: 'var(--text-primary)',
    borderColor: 'var(--border)',
  };

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
            <Wand2 size={20} style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              AI Question Generator
            </h2>
          </div>
          <button onClick={onClose} className="p-1 rounded cursor-pointer" style={{ color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Skills Selection */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Skills
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium"
                  style={{ backgroundColor: `var(--accent)20`, color: 'var(--accent)' }}
                >
                  {skill}
                  <button
                    onClick={() => setSelectedSkills(selectedSkills.filter((s) => s !== skill))}
                    className="cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
            <div className="relative">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                placeholder="Type to search skills..."
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              />
              {skillInput && filteredSuggestions.length > 0 && (
                <div
                  className="absolute z-10 w-full mt-1 rounded-lg border shadow-lg max-h-40 overflow-y-auto"
                  style={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border)' }}
                >
                  {filteredSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedSkills([...selectedSkills, s]);
                        setSkillInput('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm cursor-pointer hover:opacity-80"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Type + Difficulty + Count */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Type
              </label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Difficulty
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              >
                {DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                Count
              </label>
              <input
                type="number"
                min={1}
                max={10}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={generating || selectedSkills.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {generating ? 'Generating...' : 'Generate Questions'}
          </button>

          {/* Generated Questions */}
          {generatedQuestions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Generated Questions ({generatedQuestions.length})
              </h3>
              {generatedQuestions.map((q, i) => (
                <div
                  key={i}
                  className="rounded-lg border p-4"
                  style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {q.title}
                      </p>
                      <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                        {q.body}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="px-2 py-0.5 rounded text-xs"
                          style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                        >
                          {q.type}
                        </span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {q.difficulty} | {q.max_score} pts
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => onAddToBank(q)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium cursor-pointer shrink-0"
                      style={{ backgroundColor: 'var(--success)', color: '#fff' }}
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
