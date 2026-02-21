import { useState, useEffect } from 'react';
import { Loader2, Search, Layers, Clock, Zap } from 'lucide-react';

interface AssessmentTemplate {
    id: string;
    name: string;
    description: string;
    icon: string;
    role_category: string;
    estimated_duration_minutes: number;
    skills: string[];
    question_distribution: Record<string, number>;
    difficulty_mix: Record<string, number>;
    sections: Array<{ title: string; skills: string[]; question_count: number }>;
}

interface AssessmentTemplatesProps {
    onSelect: (template: AssessmentTemplate) => void;
}

const categoryLabels: Record<string, string> = {
    engineering: '💻 Engineering',
    data: '📊 Data & AI',
    infrastructure: '🚀 Infrastructure',
    quality: '🧪 Quality',
    security: '🔐 Security',
};

export default function AssessmentTemplates({ onSelect }: AssessmentTemplatesProps) {
    const [templates, setTemplates] = useState<AssessmentTemplate[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchTemplates = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/v1/templates/', {
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
                if (res.ok) {
                    const data = await res.json();
                    setTemplates(data.templates || []);
                    setCategories(data.categories || []);
                }
            } catch {
                // Silently fail
            } finally {
                setLoading(false);
            }
        };
        fetchTemplates();
    }, []);

    const filtered = templates.filter(t => {
        if (selectedCategory && t.role_category !== selectedCategory) return false;
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) ||
                t.skills.some(s => s.toLowerCase().includes(q));
        }
        return true;
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Loader2 size={20} className="animate-spin" /> Loading templates...
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Assessment Templates</h2>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Choose a role-based template to quickly create assessments</p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <div className="relative flex-1 max-w-xs">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search templates..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
                    />
                </div>
                <button
                    onClick={() => setSelectedCategory('')}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{
                        backgroundColor: !selectedCategory ? 'var(--accent)' : 'var(--bg-secondary)',
                        color: !selectedCategory ? '#fff' : 'var(--text-secondary)',
                    }}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                        className="px-3 py-2 rounded-lg text-xs font-medium transition-colors"
                        style={{
                            backgroundColor: selectedCategory === cat ? 'var(--accent)' : 'var(--bg-secondary)',
                            color: selectedCategory === cat ? '#fff' : 'var(--text-secondary)',
                        }}
                    >
                        {categoryLabels[cat] || cat}
                    </button>
                ))}
            </div>

            {/* Template Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filtered.map(template => {
                    const totalQuestions = Object.values(template.question_distribution).reduce((a, b) => a + b, 0);
                    return (
                        <button
                            key={template.id}
                            onClick={() => onSelect(template)}
                            className="group text-left rounded-xl p-5 transition-all hover:scale-[1.02]"
                            style={{
                                backgroundColor: 'var(--card-bg)',
                                border: '1px solid var(--border)',
                                boxShadow: 'var(--card-shadow)',
                            }}
                        >
                            <div className="text-3xl mb-3">{template.icon}</div>
                            <h3 className="font-semibold text-base mb-1" style={{ color: 'var(--text-primary)' }}>
                                {template.name}
                            </h3>
                            <p className="text-xs mb-4 line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                                {template.description}
                            </p>

                            <div className="flex items-center gap-3 text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>
                                <span className="flex items-center gap-1"><Clock size={12} /> {template.estimated_duration_minutes}m</span>
                                <span className="flex items-center gap-1"><Layers size={12} /> {totalQuestions}q</span>
                                <span className="flex items-center gap-1"><Zap size={12} /> {template.sections.length}s</span>
                            </div>

                            <div className="flex flex-wrap gap-1.5">
                                {template.skills.slice(0, 4).map(skill => (
                                    <span
                                        key={skill}
                                        className="px-2 py-0.5 rounded text-[10px] font-medium"
                                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                                    >
                                        {skill}
                                    </span>
                                ))}
                                {template.skills.length > 4 && (
                                    <span className="text-[10px] py-0.5" style={{ color: 'var(--text-muted)' }}>
                                        +{template.skills.length - 4} more
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
                    No templates match your search
                </div>
            )}
        </div>
    );
}
