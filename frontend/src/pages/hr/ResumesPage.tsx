import { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  User,
  Mail,
  Briefcase,
  GraduationCap,
  Zap,
  AlertCircle,
  Loader2,
  X,
  Sparkles,
  Link,
  Copy,
  CheckCircle2,
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { aiService } from '../../services/aiService';
import type { ResumeUpload, ResumeDetail } from '../../services/aiService';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  uploaded: { bg: '#3b82f620', text: '#3b82f6', label: 'Uploaded' },
  parsing: { bg: '#f59e0b20', text: '#f59e0b', label: 'Parsing' },
  parsed: { bg: '#10b98120', text: '#10b981', label: 'Parsed' },
  failed: { bg: '#ef444420', text: '#ef4444', label: 'Failed' },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.uploaded;
  return (
    <span
      className="px-2 py-1 rounded-full text-xs font-medium"
      style={{ backgroundColor: config.bg, color: config.text }}
    >
      {config.label}
    </span>
  );
}

function ConfidenceBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  let color = 'var(--danger)';
  if (pct >= 80) color = 'var(--success)';
  else if (pct >= 50) color = 'var(--warning)';

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs font-medium w-10 text-right" style={{ color: 'var(--text-secondary)' }}>
        {pct}%
      </span>
    </div>
  );
}

export default function ResumesPage() {
  const [resumes, setResumes] = useState<ResumeUpload[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [loading, setLoading] = useState(true);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resumeDetail, setResumeDetail] = useState<ResumeDetail | null>(null);

  const [candidateEmail, setCandidateEmail] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Create Assessment Pipeline state
  const [pipelineLoading, setPipelineLoading] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pipelineResult, setPipelineResult] = useState<any | null>(null);

  const fetchResumes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await aiService.listResumes((page - 1) * pageSize, pageSize);
      setResumes(data.resumes);
      setTotal(data.total);
    } catch {
      toast.error('Failed to load resumes');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file');
      return;
    }
    if (!candidateEmail.trim()) {
      toast.error('Please enter candidate email');
      return;
    }

    setUploading(true);
    try {
      await aiService.uploadResume(
        selectedFile,
        candidateEmail.trim(),
        candidateName.trim() || undefined,
      );
      toast.success('Resume uploaded successfully');
      setSelectedFile(null);
      setCandidateEmail('');
      setCandidateName('');
      setPage(1);
      fetchResumes();
    } catch {
      toast.error('Failed to upload resume');
    } finally {
      setUploading(false);
    }
  };

  const handleExpandToggle = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setResumeDetail(null);
      return;
    }

    setExpandedId(id);
    setDetailLoading(true);
    setResumeDetail(null);
    try {
      const detail = await aiService.getResume(id);
      setResumeDetail(detail);
    } catch {
      toast.error('Failed to load resume details');
      setExpandedId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // Create Assessment Pipeline handler
  const handleCreateAssessment = async (resumeId: string) => {
    setPipelineLoading(resumeId);
    try {
      const result = await aiService.createAssessmentFromResume(resumeId, {
        send_email: true,
      });
      setPipelineResult(result);
      toast.success(`Assessment created with ${result.questions_generated} questions!`);
    } catch {
      toast.error('Failed to create assessment from resume');
    } finally {
      setPipelineLoading(null);
    }
  };

  const totalPages = Math.ceil(total / pageSize);

  const parsedData = resumeDetail?.parsed_data as Record<string, unknown> | null;
  const matchedSkills = resumeDetail?.matched_skills as Record<string, unknown> | null;

  const parsedName = (parsedData?.name as string) || null;
  const parsedEmail = (parsedData?.email as string) || null;
  const parsedSkills = (parsedData?.skills as string[]) || null;
  const parsedExperience = (parsedData?.experience as Array<Record<string, string>>) || null;
  const parsedEducation = (parsedData?.education as Array<Record<string, string>>) || null;

  const skillScores = matchedSkills
    ? Object.entries(matchedSkills).map(([skill, value]) => ({
      skill,
      confidence: typeof value === 'number' ? value : (value as Record<string, unknown>)?.confidence as number ?? 0,
    }))
    : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Resumes
        </h1>
        <button
          onClick={fetchResumes}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
          }}
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Upload Section */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <h2
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text-primary)' }}
        >
          Upload Resume
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Candidate Email *
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="email"
                placeholder="candidate@example.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
          <div>
            <label
              className="block text-sm font-medium mb-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Candidate Name
            </label>
            <div className="relative">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Full name (optional)"
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border)',
                }}
              />
            </div>
          </div>
        </div>

        <div
          {...getRootProps()}
          className="rounded-xl p-8 text-center cursor-pointer transition-colors"
          style={{
            border: `2px dashed ${isDragActive ? 'var(--accent)' : 'var(--border)'}`,
            backgroundColor: isDragActive ? 'var(--accent)08' : 'var(--bg-secondary)',
          }}
        >
          <input {...getInputProps()} />
          <Upload
            size={32}
            className="mx-auto mb-3"
            style={{ color: isDragActive ? 'var(--accent)' : 'var(--text-muted)' }}
          />
          {isDragActive ? (
            <p className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Drop the file here
            </p>
          ) : (
            <>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Drag and drop a resume file here, or click to browse
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Supported formats: PDF, DOCX
              </p>
            </>
          )}
        </div>

        {selectedFile && (
          <div
            className="flex items-center justify-between mt-3 px-4 py-2 rounded-lg"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="flex items-center gap-2">
              <FileText size={16} style={{ color: 'var(--accent)' }} />
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {selectedFile.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                ({(selectedFile.size / 1024).toFixed(1)} KB)
              </span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="p-1 rounded hover:opacity-70"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        <div className="flex justify-end mt-4">
          <button
            onClick={handleUpload}
            disabled={uploading || !selectedFile || !candidateEmail.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {uploading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={16} />
                Upload Resume
              </>
            )}
          </button>
        </div>
      </div>

      {/* Resumes List */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--card-shadow)',
        }}
      >
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Name', 'Email', 'Type', 'Status', 'Uploaded', ''].map((h) => (
                <th
                  key={h || '_expand'}
                  className="text-left px-4 py-3 text-xs font-semibold uppercase"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Loader2
                    size={24}
                    className="animate-spin mx-auto mb-2"
                    style={{ color: 'var(--accent)' }}
                  />
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Loading resumes...
                  </p>
                </td>
              </tr>
            ) : resumes.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <FileText
                    size={32}
                    className="mx-auto mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  />
                  <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                    No resumes uploaded yet
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    Upload a resume using the form above to get started.
                  </p>
                </td>
              </tr>
            ) : (
              resumes.map((resume) => (
                <>
                  <tr
                    key={resume.id}
                    className="cursor-pointer hover:opacity-80"
                    style={{ borderBottom: expandedId === resume.id ? undefined : '1px solid var(--border)' }}
                    onClick={() => handleExpandToggle(resume.id)}
                  >
                    <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {resume.candidate_name || '--'}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {resume.candidate_email}
                    </td>
                    <td className="px-4 py-3 text-sm uppercase" style={{ color: 'var(--text-muted)' }}>
                      {resume.file_type}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={resume.status} />
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(resume.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {expandedId === resume.id ? (
                        <ChevronUp size={16} style={{ color: 'var(--text-muted)' }} />
                      ) : (
                        <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                      )}
                    </td>
                  </tr>

                  {expandedId === resume.id && (
                    <tr key={`${resume.id}-detail`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={6} className="px-4 py-0">
                        <div
                          className="py-5 px-4 my-2 rounded-xl"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border)',
                          }}
                        >
                          {detailLoading ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2
                                size={20}
                                className="animate-spin mr-2"
                                style={{ color: 'var(--accent)' }}
                              />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Loading details...
                              </span>
                            </div>
                          ) : !resumeDetail ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                              <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Could not load resume details.
                              </span>
                            </div>
                          ) : resumeDetail.status === 'failed' ? (
                            <div className="flex items-center gap-2 py-4">
                              <AlertCircle size={16} style={{ color: 'var(--danger)' }} />
                              <span className="text-sm" style={{ color: 'var(--danger)' }}>
                                Parsing failed: {resumeDetail.error_message || 'Unknown error'}
                              </span>
                            </div>
                          ) : resumeDetail.status === 'parsing' ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                              <Loader2
                                size={16}
                                className="animate-spin"
                                style={{ color: 'var(--warning)' }}
                              />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Resume is currently being parsed. Check back in a moment.
                              </span>
                            </div>
                          ) : resumeDetail.status === 'uploaded' ? (
                            <div className="flex items-center justify-center py-8 gap-2">
                              <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                Resume uploaded. Parsing has not started yet.
                              </span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Parsed Data Column */}
                              <div>
                                <h3
                                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <FileText size={15} />
                                  Parsed Information
                                </h3>

                                {/* Name & Email */}
                                <div className="space-y-3 mb-4">
                                  {parsedName && (
                                    <div className="flex items-center gap-2">
                                      <User size={14} style={{ color: 'var(--text-muted)' }} />
                                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Name:</span>
                                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{parsedName}</span>
                                    </div>
                                  )}
                                  {parsedEmail && (
                                    <div className="flex items-center gap-2">
                                      <Mail size={14} style={{ color: 'var(--text-muted)' }} />
                                      <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Email:</span>
                                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{parsedEmail}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Skills */}
                                {parsedSkills && parsedSkills.length > 0 && (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Zap size={14} style={{ color: 'var(--text-muted)' }} />
                                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        Skills
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {parsedSkills.map((skill) => (
                                        <span
                                          key={skill}
                                          className="px-2 py-0.5 rounded-md text-xs font-medium"
                                          style={{
                                            backgroundColor: 'var(--accent)15',
                                            color: 'var(--accent)',
                                            border: '1px solid var(--accent)30',
                                          }}
                                        >
                                          {skill}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Experience */}
                                {parsedExperience && parsedExperience.length > 0 && (
                                  <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Briefcase size={14} style={{ color: 'var(--text-muted)' }} />
                                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        Experience
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {parsedExperience.map((exp, idx) => (
                                        <div
                                          key={idx}
                                          className="rounded-lg p-3"
                                          style={{
                                            backgroundColor: 'var(--card-bg)',
                                            border: '1px solid var(--border)',
                                          }}
                                        >
                                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {exp.title || exp.role || exp.position || 'Role'}
                                          </p>
                                          {(exp.company || exp.organization) && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                              {exp.company || exp.organization}
                                            </p>
                                          )}
                                          {(exp.duration || exp.dates || exp.period) && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                              {exp.duration || exp.dates || exp.period}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Education */}
                                {parsedEducation && parsedEducation.length > 0 && (
                                  <div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <GraduationCap size={14} style={{ color: 'var(--text-muted)' }} />
                                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        Education
                                      </span>
                                    </div>
                                    <div className="space-y-2">
                                      {parsedEducation.map((edu, idx) => (
                                        <div
                                          key={idx}
                                          className="rounded-lg p-3"
                                          style={{
                                            backgroundColor: 'var(--card-bg)',
                                            border: '1px solid var(--border)',
                                          }}
                                        >
                                          <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                            {edu.degree || edu.qualification || 'Degree'}
                                          </p>
                                          {(edu.institution || edu.school || edu.university) && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                              {edu.institution || edu.school || edu.university}
                                            </p>
                                          )}
                                          {(edu.year || edu.dates || edu.period) && (
                                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                              {edu.year || edu.dates || edu.period}
                                            </p>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {/* Fallback if parsed but no structured data */}
                                {!parsedName && !parsedEmail && !parsedSkills && !parsedExperience && !parsedEducation && parsedData && (
                                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                    Parsed data available but no structured fields were extracted.
                                  </p>
                                )}
                              </div>

                              {/* Matched Skills Column */}
                              <div>
                                <h3
                                  className="text-sm font-semibold mb-3 flex items-center gap-2"
                                  style={{ color: 'var(--text-primary)' }}
                                >
                                  <Zap size={15} />
                                  Matched Skills
                                </h3>

                                {skillScores && skillScores.length > 0 ? (
                                  <div className="space-y-3">
                                    {skillScores
                                      .sort((a, b) => b.confidence - a.confidence)
                                      .map(({ skill, confidence }) => (
                                        <div key={skill}>
                                          <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                                              {skill}
                                            </span>
                                          </div>
                                          <ConfidenceBar score={confidence} />
                                        </div>
                                      ))}
                                  </div>
                                ) : (
                                  <div
                                    className="flex flex-col items-center justify-center py-8 rounded-lg"
                                    style={{
                                      backgroundColor: 'var(--card-bg)',
                                      border: '1px solid var(--border)',
                                    }}
                                  >
                                    <Zap size={24} className="mb-2" style={{ color: 'var(--text-muted)' }} />
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                                      No matched skills available.
                                    </p>
                                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                      Skills will appear here once the resume is processed against a taxonomy.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Create Assessment Pipeline Button */}
                          {resumeDetail?.status === 'parsed' && (
                            <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleCreateAssessment(resume.id); }}
                                disabled={pipelineLoading === resume.id}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-white text-sm font-medium transition-all hover:shadow-lg disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
                              >
                                {pipelineLoading === resume.id ? (
                                  <><Loader2 size={16} className="animate-spin" /> Creating assessment...</>
                                ) : (
                                  <><Sparkles size={16} /> Create Assessment & Send Invite</>
                                )}
                              </button>
                              <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--text-muted)' }}>
                                AI will generate questions from matched skills, create an assessment, and send an invite link.
                              </p>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {total > 0 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg disabled:opacity-40"
                style={{ color: 'var(--text-secondary)' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline Result Dialog */}
      {pipelineResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl p-6 shadow-2xl" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
                Assessment Created!
              </h2>
              <button onClick={() => setPipelineResult(null)} className="p-1 rounded-lg hover:bg-black/5" style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Assessment</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pipelineResult.assessment_title}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Candidate</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pipelineResult.candidate_name} ({pipelineResult.candidate_email})</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Questions Generated</span>
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{pipelineResult.questions_generated}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Skills Tested</span>
                <div className="flex flex-wrap gap-1">
                  {pipelineResult.skills_tested?.map((s: string) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: '#8b5cf620', color: '#8b5cf6' }}>{s}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <Link size={14} style={{ color: 'var(--accent)' }} />
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Invite Link</span>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs p-2 rounded bg-black/5 overflow-x-auto" style={{ color: 'var(--text-secondary)' }}>
                  {pipelineResult.invite_link}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(pipelineResult.invite_link); toast.success('Link copied!'); }} className="p-2 rounded-lg hover:bg-black/5" style={{ color: 'var(--accent)' }} title="Copy link">
                  <Copy size={16} />
                </button>
              </div>
            </div>

            <div className="flex justify-end mt-4">
              <button onClick={() => setPipelineResult(null)} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: 'var(--accent)' }}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
