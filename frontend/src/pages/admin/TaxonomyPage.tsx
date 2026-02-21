import { useState, useEffect, useCallback, useRef } from 'react';
import { taxonomyService } from '../../services/taxonomyService';
import type { Technology, Skill } from '../../types/taxonomy';
import { useAuthStore } from '../../store/authStore';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Loader2,
  Search,
  Sparkles,
  Upload,
  FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { value: 'language', label: 'Languages' },
  { value: 'framework', label: 'Frameworks' },
  { value: 'database', label: 'Databases' },
  { value: 'cloud', label: 'Cloud' },
  { value: 'tool', label: 'Tools' },
  { value: 'concept', label: 'Concepts' },
  { value: 'other', label: 'Other' },
];

export default function TaxonomyPage() {
  const role = useAuthStore((s) => s.role);
  const organizationId = useAuthStore((s) => s.organizationId);
  const isSuperAdmin = role === 'super_admin';
  // Admin can only edit/delete their own org's entries; global entries are read-only for them
  const canEditTech = (tech: Technology) =>
    isSuperAdmin || (tech.organization_id !== null && tech.organization_id === organizationId);
  const canEditSkillForTech = (tech: Technology) => canEditTech(tech);

  const [technologies, setTechnologies] = useState<Technology[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTechs, setExpandedTechs] = useState<Set<string>>(new Set());
  const [techSkills, setTechSkills] = useState<Record<string, Skill[]>>({});
  const [loadingSkills, setLoadingSkills] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  // Add technology state
  const [showAddTech, setShowAddTech] = useState(false);
  const [newTechName, setNewTechName] = useState('');
  const [newTechCategory, setNewTechCategory] = useState('language');

  // Edit technology state
  const [editingTech, setEditingTech] = useState<string | null>(null);
  const [editTechName, setEditTechName] = useState('');

  // Add skill state
  const [addingSkillTo, setAddingSkillTo] = useState<string | null>(null);
  const [newSkillName, setNewSkillName] = useState('');

  // Edit skill state
  const [editingSkill, setEditingSkill] = useState<string | null>(null);
  const [editSkillName, setEditSkillName] = useState('');

  // AI Generate state
  const [showAIGenerate, setShowAIGenerate] = useState(false);
  const [aiMode, setAiMode] = useState<'topic' | 'jd'>('topic');
  const [aiTopic, setAiTopic] = useState('');
  const [aiJD, setAiJD] = useState('');
  const [aiCount, setAiCount] = useState(5);
  const [aiAutoSave, setAiAutoSave] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiPreview, setAiPreview] = useState<any[] | null>(null);

  // Bulk Upload state
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  const fetchTechnologies = useCallback(async () => {
    try {
      setLoading(true);
      const data = await taxonomyService.getTechnologies();
      setTechnologies(data);
    } catch {
      toast.error('Failed to load technologies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTechnologies();
  }, [fetchTechnologies]);

  const toggleExpand = async (techId: string) => {
    const next = new Set(expandedTechs);
    if (next.has(techId)) {
      next.delete(techId);
    } else {
      next.add(techId);
      if (!techSkills[techId]) {
        setLoadingSkills((prev) => new Set(prev).add(techId));
        try {
          const skills = await taxonomyService.getSkills(techId);
          setTechSkills((prev) => ({ ...prev, [techId]: skills }));
        } catch {
          toast.error('Failed to load skills');
        } finally {
          setLoadingSkills((prev) => {
            const s = new Set(prev);
            s.delete(techId);
            return s;
          });
        }
      }
    }
    setExpandedTechs(next);
  };

  const handleAddTechnology = async () => {
    if (!newTechName.trim()) return;
    try {
      await taxonomyService.createTechnology({
        name: newTechName.trim(),
        category: newTechCategory,
      });
      toast.success('Technology created');
      setNewTechName('');
      setShowAddTech(false);
      fetchTechnologies();
    } catch {
      toast.error('Failed to create technology');
    }
  };

  const handleUpdateTechnology = async (id: string) => {
    if (!editTechName.trim()) return;
    try {
      await taxonomyService.updateTechnology(id, { name: editTechName.trim() });
      toast.success('Technology updated');
      setEditingTech(null);
      fetchTechnologies();
    } catch {
      toast.error('Failed to update technology');
    }
  };

  const handleDeleteTechnology = async (id: string) => {
    if (!confirm('Delete this technology and all its skills?')) return;
    try {
      await taxonomyService.deleteTechnology(id);
      toast.success('Technology deleted');
      fetchTechnologies();
    } catch {
      toast.error('Failed to delete technology');
    }
  };

  const handleAddSkill = async (techId: string) => {
    if (!newSkillName.trim()) return;
    try {
      await taxonomyService.createSkill({
        technology_id: techId,
        name: newSkillName.trim(),
      });
      toast.success('Skill created');
      setNewSkillName('');
      setAddingSkillTo(null);
      const skills = await taxonomyService.getSkills(techId);
      setTechSkills((prev) => ({ ...prev, [techId]: skills }));
    } catch {
      toast.error('Failed to create skill');
    }
  };

  const handleUpdateSkill = async (skillId: string, techId: string) => {
    if (!editSkillName.trim()) return;
    try {
      await taxonomyService.updateSkill(skillId, { name: editSkillName.trim() });
      toast.success('Skill updated');
      setEditingSkill(null);
      const skills = await taxonomyService.getSkills(techId);
      setTechSkills((prev) => ({ ...prev, [techId]: skills }));
    } catch {
      toast.error('Failed to update skill');
    }
  };

  const handleDeleteSkill = async (skillId: string, techId: string) => {
    if (!confirm('Delete this skill?')) return;
    try {
      await taxonomyService.deleteSkill(skillId);
      toast.success('Skill deleted');
      const skills = await taxonomyService.getSkills(techId);
      setTechSkills((prev) => ({ ...prev, [techId]: skills }));
    } catch {
      toast.error('Failed to delete skill');
    }
  };

  // AI Generate handler
  const handleAIGenerate = async () => {
    setAiLoading(true);
    try {
      const body: Record<string, unknown> = { auto_save: aiAutoSave };
      if (aiMode === 'topic') {
        body.topic = aiTopic;
        body.count = aiCount;
      } else {
        body.job_description = aiJD;
      }
      const result = await taxonomyService.aiGenerate(body as Parameters<typeof taxonomyService.aiGenerate>[0]);
      if (aiAutoSave) {
        toast.success(`Created ${result.total_technologies} technologies with ${result.total_skills} skills!`);
        setShowAIGenerate(false);
        setAiTopic('');
        setAiJD('');
        setAiPreview(null);
        fetchTechnologies();
      } else {
        setAiPreview(result.technologies);
        toast.success('Preview generated! Review below.');
      }
    } catch {
      toast.error('AI generation failed');
    } finally {
      setAiLoading(false);
    }
  };

  // Save previewed AI taxonomy
  const handleSavePreview = async () => {
    if (!aiPreview) return;
    setAiLoading(true);
    try {
      const body: Record<string, unknown> = { auto_save: true };
      if (aiMode === 'topic') {
        body.topic = aiTopic;
        body.count = aiCount;
      } else {
        body.job_description = aiJD;
      }
      await taxonomyService.aiGenerate(body as Parameters<typeof taxonomyService.aiGenerate>[0]);
      toast.success('Taxonomy saved!');
      setShowAIGenerate(false);
      setAiTopic('');
      setAiJD('');
      setAiPreview(null);
      fetchTechnologies();
    } catch {
      toast.error('Failed to save');
    } finally {
      setAiLoading(false);
    }
  };

  // Bulk Upload handler
  const handleBulkUpload = async (file: File) => {
    setBulkLoading(true);
    try {
      const result = await taxonomyService.bulkUpload(file);
      toast.success(`Created ${result.created_technologies} technologies, ${result.created_skills} skills (${result.skipped} skipped)`);
      setShowBulkUpload(false);
      fetchTechnologies();
    } catch {
      toast.error('Bulk upload failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const filtered = technologies.filter((t) => {
    if (filterCategory && t.category !== filterCategory) return false;
    if (searchQuery && !t.name.toLowerCase().includes(searchQuery.toLowerCase()))
      return false;
    return true;
  });

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    techs: filtered.filter((t) => t.category === cat.value),
  })).filter((g) => g.techs.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin" size={32} style={{ color: 'var(--accent)' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Technology Taxonomy
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {technologies.length} technologies
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIGenerate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-all hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          >
            <Sparkles size={16} />
            AI Generate
          </button>
          <button
            onClick={() => setShowBulkUpload(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          >
            <Upload size={16} />
            Bulk Upload
          </button>
          <button
            onClick={() => setShowAddTech(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            <Plus size={16} />
            Add Technology
          </button>
        </div>
      </div>

      {/* AI Generate Dialog */}
      {showAIGenerate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Sparkles size={20} style={{ color: '#8b5cf6' }} />
                AI Taxonomy Generator
              </h2>
              <button onClick={() => { setShowAIGenerate(false); setAiPreview(null); }} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {/* Mode tabs */}
            <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <button onClick={() => setAiMode('topic')} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${aiMode === 'topic' ? 'shadow-sm' : ''}`} style={{ backgroundColor: aiMode === 'topic' ? 'var(--card-bg)' : 'transparent', color: aiMode === 'topic' ? 'var(--text-primary)' : 'var(--text-muted)' }}>From Topic</button>
              <button onClick={() => setAiMode('jd')} className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${aiMode === 'jd' ? 'shadow-sm' : ''}`} style={{ backgroundColor: aiMode === 'jd' ? 'var(--card-bg)' : 'transparent', color: aiMode === 'jd' ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                <FileText size={14} className="inline mr-1" />From Job Description
              </button>
            </div>

            {aiMode === 'topic' ? (
              <div className="space-y-3">
                <input type="text" placeholder="e.g. Full-Stack Web Development, Machine Learning, DevOps..." value={aiTopic} onChange={(e) => setAiTopic(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                <div className="flex items-center gap-2">
                  <label className="text-sm" style={{ color: 'var(--text-secondary)' }}>Technologies to generate:</label>
                  <input type="number" min={1} max={15} value={aiCount} onChange={(e) => setAiCount(Number(e.target.value))} className="w-16 px-2 py-1 rounded text-sm text-center" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
                </div>
              </div>
            ) : (
              <textarea placeholder="Paste the full job description here..." value={aiJD} onChange={(e) => setAiJD(e.target.value)} rows={6} className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            )}

            <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={aiAutoSave} onChange={(e) => setAiAutoSave(e.target.checked)} className="rounded" />
              Auto-save to taxonomy (skip preview)
            </label>

            {/* Preview */}
            {aiPreview && (
              <div className="mt-4 space-y-2 max-h-60 overflow-y-auto rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>PREVIEW — {aiPreview.length} technologies</p>
                {aiPreview.map((t, i) => (
                  <div key={i} className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    <span className="font-medium">{t.name}</span>
                    <span className="text-xs ml-1" style={{ color: 'var(--text-muted)' }}>({t.category})</span>
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {(t.skills || []).map((s: { name: string }, j: number) => (
                        <span key={j} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>{s.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => { setShowAIGenerate(false); setAiPreview(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancel</button>
              {aiPreview ? (
                <button onClick={handleSavePreview} disabled={aiLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: 'var(--success)' }}>
                  {aiLoading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  Save to Taxonomy
                </button>
              ) : (
                <button onClick={handleAIGenerate} disabled={aiLoading || (!aiTopic && !aiJD)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  {aiLoading ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                  {aiAutoSave ? 'Generate & Save' : 'Generate Preview'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload Dialog */}
      {showBulkUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Upload size={20} style={{ color: 'var(--accent)' }} />
                Bulk Upload Taxonomy
              </h2>
              <button onClick={() => setShowBulkUpload(false)} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="text-sm space-y-2 mb-4" style={{ color: 'var(--text-secondary)' }}>
              <p><strong>CSV format:</strong> technology, category, skill, description</p>
              <p><strong>JSON format:</strong> Array of {'{name, category, skills: [{name, description}]}'}</p>
            </div>

            <input type="file" ref={bulkFileRef} accept=".csv,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBulkUpload(f); }} />

            <button onClick={() => bulkFileRef.current?.click()} disabled={bulkLoading} className="w-full flex items-center justify-center gap-2 px-4 py-8 rounded-xl text-sm font-medium transition-all cursor-pointer" style={{ border: '2px dashed var(--border)', color: 'var(--text-muted)', backgroundColor: 'var(--bg-secondary)' }}>
              {bulkLoading ? (
                <><Loader2 className="animate-spin" size={20} /> Uploading...</>
              ) : (
                <><Upload size={20} /> Click to select CSV or JSON file</>
              )}
            </button>

            <div className="flex justify-end mt-4">
              <button onClick={() => setShowBulkUpload(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div
        className="flex items-center gap-3 mb-4 p-3 rounded-lg"
        style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}
      >
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search technologies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        >
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Add Technology Form */}
      {showAddTech && (
        <div
          className="mb-4 p-4 rounded-lg"
          style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--accent)' }}
        >
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Technology name"
              value={newTechName}
              onChange={(e) => setNewTechName(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddTechnology()}
            />
            <select
              value={newTechCategory}
              onChange={(e) => setNewTechCategory(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              onClick={handleAddTechnology}
              className="p-2 rounded-lg text-white"
              style={{ backgroundColor: 'var(--success)' }}
            >
              <Check size={16} />
            </button>
            <button
              onClick={() => {
                setShowAddTech(false);
                setNewTechName('');
              }}
              className="p-2 rounded-lg"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Technology Tree */}
      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.value}>
            <h2
              className="text-xs font-semibold uppercase tracking-wider mb-2 px-1"
              style={{ color: 'var(--text-muted)' }}
            >
              {group.label} ({group.techs.length})
            </h2>
            <div
              className="rounded-xl overflow-hidden"
              style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--border)',
              }}
            >
              {group.techs.map((tech, idx) => (
                <div
                  key={tech.id}
                  style={{
                    borderBottom:
                      idx < group.techs.length - 1 ? '1px solid var(--border)' : undefined,
                  }}
                >
                  {/* Technology Row */}
                  <div className="flex items-center gap-2 px-4 py-3">
                    <button
                      onClick={() => toggleExpand(tech.id)}
                      className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {expandedTechs.has(tech.id) ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                    </button>

                    {editingTech === tech.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editTechName}
                          onChange={(e) => setEditTechName(e.target.value)}
                          className="flex-1 px-2 py-1 rounded text-sm outline-none"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                            color: 'var(--text-primary)',
                          }}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateTechnology(tech.id);
                            if (e.key === 'Escape') setEditingTech(null);
                          }}
                        />
                        <button
                          onClick={() => handleUpdateTechnology(tech.id)}
                          className="p-1 rounded"
                          style={{ color: 'var(--success)' }}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingTech(null)}
                          className="p-1 rounded"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span
                          className="font-medium text-sm flex-1 cursor-pointer"
                          style={{ color: 'var(--text-primary)' }}
                          onClick={() => toggleExpand(tech.id)}
                        >
                          {tech.name}
                        </span>
                        {/* Global / Org badge */}
                        {tech.organization_id === null ? (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}
                            title="Global master data — managed by super admin"
                          >
                            Global
                          </span>
                        ) : (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: '#dcfce7', color: '#15803d' }}
                            title="Added by your organization"
                          >
                            Org
                          </span>
                        )}
                        <span
                          className="text-xs px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {tech.category}
                        </span>
                        {canEditTech(tech) && (
                          <>
                            <button
                              onClick={() => {
                                setEditingTech(tech.id);
                                setEditTechName(tech.name);
                              }}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5"
                              style={{ color: 'var(--text-muted)' }}
                              title="Edit"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteTechnology(tech.id)}
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-black/5"
                              style={{ color: 'var(--danger)' }}
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {/* Skills (expanded) */}
                  {expandedTechs.has(tech.id) && (
                    <div
                      className="px-4 pb-3 ml-7"
                      style={{ borderTop: '1px solid var(--border)' }}
                    >
                      {loadingSkills.has(tech.id) ? (
                        <div className="flex items-center gap-2 py-3 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <Loader2 className="animate-spin" size={14} />
                          Loading skills...
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-2 py-3">
                            {(techSkills[tech.id] || []).map((skill) => (
                              <div key={skill.id}>
                                {editingSkill === skill.id ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="text"
                                      value={editSkillName}
                                      onChange={(e) => setEditSkillName(e.target.value)}
                                      className="px-2 py-1 rounded text-xs outline-none w-40"
                                      style={{
                                        backgroundColor: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text-primary)',
                                      }}
                                      autoFocus
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                          handleUpdateSkill(skill.id, tech.id);
                                        if (e.key === 'Escape') setEditingSkill(null);
                                      }}
                                    />
                                    <button
                                      onClick={() => handleUpdateSkill(skill.id, tech.id)}
                                      style={{ color: 'var(--success)' }}
                                    >
                                      <Check size={12} />
                                    </button>
                                    <button
                                      onClick={() => setEditingSkill(null)}
                                      style={{ color: 'var(--text-muted)' }}
                                    >
                                      <X size={12} />
                                    </button>
                                  </div>
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs group cursor-default"
                                    style={{
                                      backgroundColor: 'var(--bg-tertiary)',
                                      color: 'var(--text-secondary)',
                                    }}
                                  >
                                    {skill.name}
                                    {canEditSkillForTech(tech) && (
                                      <>
                                        <button
                                          onClick={() => {
                                            setEditingSkill(skill.id);
                                            setEditSkillName(skill.name);
                                          }}
                                          className="ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                          style={{ color: 'var(--text-muted)' }}
                                        >
                                          <Pencil size={10} />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteSkill(skill.id, tech.id)}
                                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                                          style={{ color: 'var(--danger)' }}
                                        >
                                          <Trash2 size={10} />
                                        </button>
                                      </>
                                    )}
                                  </span>
                                )}
                              </div>
                            ))}

                            {canEditSkillForTech(tech) && addingSkillTo === tech.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  placeholder="Skill name"
                                  value={newSkillName}
                                  onChange={(e) => setNewSkillName(e.target.value)}
                                  className="px-2 py-1 rounded text-xs outline-none w-40"
                                  style={{
                                    backgroundColor: 'var(--bg-secondary)',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-primary)',
                                  }}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleAddSkill(tech.id);
                                    if (e.key === 'Escape') {
                                      setAddingSkillTo(null);
                                      setNewSkillName('');
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleAddSkill(tech.id)}
                                  style={{ color: 'var(--success)' }}
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => {
                                    setAddingSkillTo(null);
                                    setNewSkillName('');
                                  }}
                                  style={{ color: 'var(--text-muted)' }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : canEditSkillForTech(tech) ? (
                              <button
                                onClick={() => setAddingSkillTo(tech.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors"
                                style={{
                                  border: '1px dashed var(--border)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                <Plus size={10} />
                                Add skill
                              </button>
                            ) : null}
                          </div>
                          {(techSkills[tech.id] || []).length === 0 && (
                            <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
                              No skills yet. Add one above.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <div
          className="text-center py-12 rounded-xl"
          style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-muted)',
          }}
        >
          No technologies found.
        </div>
      )}
    </div>
  );
}
