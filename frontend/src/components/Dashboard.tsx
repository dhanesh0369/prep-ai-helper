import React, { useState, useEffect, useRef } from 'react';
import {
  Upload, FileText, ChevronRight, Award, PlusCircle, CheckCircle,
  BarChart3, Briefcase, CheckCircle2, XCircle, Lightbulb, Loader2, Target
} from 'lucide-react';
import { uploadResumeFile, fetchInterviewHistory, checkResumeCompatibility } from '../services/api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  onStartInterview: (resumeId: number | null) => void;
  onViewReport: (id: number) => void;
}

// Animated circular score ring
function ScoreRing({ score }: { score: number }) {
  const radius = 54;
  const stroke = 8;
  const normalizedRadius = radius - stroke / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e';

  return (
    <div style={{ position: 'relative', width: radius * 2, height: radius * 2, flexShrink: 0 }}>
      <svg width={radius * 2} height={radius * 2} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
        />
        <circle
          cx={radius} cy={radius} r={normalizedRadius}
          fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
      }}>
        <span style={{ fontSize: '1.5rem', fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ 100</span>
      </div>
    </div>
  );
}

export default function Dashboard({ onStartInterview, onViewReport }: DashboardProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [resumeData, setResumeData] = useState<any | null>(null);

  // Compatibility checker state
  const [compatFile, setCompatFile] = useState<File | null>(null);
  const [compatJD, setCompatJD] = useState('');
  const [compatJDFile, setCompatJDFile] = useState<File | null>(null);
  const [jdMode, setJdMode] = useState<'paste' | 'pdf'>('paste');
  const [compatLoading, setCompatLoading] = useState(false);
  const [compatError, setCompatError] = useState('');
  const [compatResult, setCompatResult] = useState<any | null>(null);
  const compatFileRef = useRef<HTMLInputElement>(null);
  const jdFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await fetchInterviewHistory();
      setHistory(data.filter((i: any) => i.status === 'completed'));
    } catch (err: any) {
      console.error('Failed to load interview history', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    setSuccessMsg('');
    setResumeData(null);
    try {
      const parsed = await uploadResumeFile(file);
      setResumeData(parsed);
      setSuccessMsg('Resume parsed and saved successfully!');
    } catch (err: any) {
      setError(err.message || 'Failed to upload and parse resume.');
    } finally {
      setUploading(false);
    }
  };

  const handleCompatCheck = async () => {
    const jdReady = jdMode === 'paste' ? compatJD.trim() : !!compatJDFile;
    if (!compatFile || !jdReady) return;
    setCompatLoading(true);
    setCompatError('');
    setCompatResult(null);
    try {
      const result = await checkResumeCompatibility(
        compatFile,
        jdMode === 'paste' ? compatJD : '',
        jdMode === 'pdf' ? compatJDFile : null
      );
      setCompatResult(result);
    } catch (err: any) {
      setCompatError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setCompatLoading(false);
    }
  };

  const isCompatReady = compatFile && (jdMode === 'paste' ? compatJD.trim() : !!compatJDFile);

  const averageScore = history.length > 0
    ? Math.round(history.reduce((acc, curr) => acc + (curr.overall_score || 0), 0) / history.length)
    : 0;

  const chartData = [...history]
    .reverse()
    .map((item) => ({
      date: new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: item.overall_score || 0,
    }));

  const scoreColor = compatResult
    ? compatResult.score >= 75 ? '#10b981' : compatResult.score >= 50 ? '#f59e0b' : '#f43f5e'
    : 'var(--accent-cyan)';

  return (
    <div className="container" style={{ padding: '40px 24px' }}>
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .compat-result { animation: fadeSlideUp 0.4s ease; }
        .skill-tag-match {
          padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
          background: rgba(16, 185, 129, 0.12); color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }
        .skill-tag-miss {
          padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 600;
          background: rgba(244, 63, 94, 0.1); color: #f43f5e;
          border: 1px solid rgba(244, 63, 94, 0.2);
        }
        .compat-drop-zone {
          border: 2px dashed var(--border-color);
          border-radius: 12px;
          padding: 18px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          background: var(--bg-tertiary);
        }
        .compat-drop-zone:hover {
          border-color: var(--accent-cyan);
          background: rgba(16, 185, 129, 0.05);
        }
        .suggestion-item {
          display: flex; gap: 10px; align-items: flex-start;
          padding: 10px 14px;
          border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border-color);
        }
      `}} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Track your progress and run personalized AI mock interviews</p>
        </div>
        <button className="btn btn-primary" onClick={() => onStartInterview(null)}>
          <PlusCircle size={18} />
          <span>Quick Custom Interview</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(6, 182, 212, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-cyan)' }}>
            <Award size={32} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>AVERAGE SCORE</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{averageScore}%</div>
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '16px', background: 'rgba(168, 85, 247, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-purple)' }}>
            <CheckCircle size={32} />
          </div>
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COMPLETED SESSIONS</div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{history.length}</div>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Left Column */}
        <div>
          {/* Resume Upload */}
          <div className="card glass-panel">
            <h2 className="card-title">
              <FileText size={20} className="text-cyan" />
              <span>Resume Integration</span>
            </h2>
            {error && (
              <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--accent-rose)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{error}</div>
            )}
            {successMsg && (
              <div style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--accent-emerald)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>{successMsg}</div>
            )}
            <label className="upload-zone" style={{ display: 'block' }}>
              <Upload size={32} />
              <div style={{ fontWeight: 600, fontSize: '0.95rem', marginBottom: '4px' }}>
                {uploading ? 'Processing resume text...' : 'Upload your resume PDF'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Supports clean layouts & multi-column formatting
              </div>
              <input type="file" accept=".pdf" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploading} />
            </label>
            {resumeData && (
              <div style={{ marginTop: '28px' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '12px' }}>EXTRACTED PROFILE DETECTED:</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
                  {resumeData.skills.slice(0, 12).map((skill: string, index: number) => (
                    <span key={index} style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600 }}>{skill}</span>
                  ))}
                  {resumeData.skills.length > 12 && (
                    <span style={{ fontSize: '0.8rem', alignSelf: 'center', color: 'var(--text-secondary)' }}>+{resumeData.skills.length - 12} more</span>
                  )}
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => onStartInterview(1)}>
                  Start Personalized Interview
                </button>
              </div>
            )}
          </div>

          {/* Score Chart */}
          {chartData.length > 0 && (
            <div className="card glass-panel">
              <h2 className="card-title">
                <BarChart3 size={20} className="text-purple" />
                <span>Score Performance Trend</span>
              </h2>
              <div style={{ width: '100%', height: 260, marginTop: '20px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--accent-cyan)" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="var(--accent-cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                    <YAxis domain={[0, 100]} stroke="var(--text-secondary)" fontSize={11} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)' }} />
                    <Area type="monotone" dataKey="score" stroke="var(--accent-cyan)" strokeWidth={2.5} fillOpacity={1} fill="url(#scoreColor)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div>
          {/* Interview History */}
          <div className="card glass-panel" style={{ minHeight: '340px' }}>
            <h2 className="card-title">Interview History</h2>
            {loading ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading past records...</p>
            ) : history.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No interviews taken yet.</p>
            ) : (
              <div className="history-list">
                {history.map((item) => {
                  const score = item.overall_score || 0;
                  const badgeClass = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
                  return (
                    <div key={item.id} className="history-item" onClick={() => onViewReport(item.id)}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{item.type} Round</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                          {new Date(item.created_at).toLocaleDateString()} • {item.difficulty}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div className={`score-badge ${badgeClass}`}>{score}</div>
                        <ChevronRight size={16} className="text-secondary" />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Resume ↔ JD Compatibility Checker ── */}
      <div className="card glass-panel" style={{ marginTop: '40px' }}>
        <h2 className="card-title">
          <Target size={20} style={{ color: 'var(--accent-cyan)' }} />
          <span>Resume ↔ JD Compatibility Checker</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '24px', marginTop: '-4px' }}>
          Upload your resume and paste a job description to get an AI-powered match score and personalised improvement tips.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Resume Upload */}
          <div>
            <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px', letterSpacing: '0.05em' }}>
              RESUME (PDF)
            </label>
            <div
              className="compat-drop-zone"
              onClick={() => compatFileRef.current?.click()}
            >
              {compatFile ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                  <FileText size={18} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{compatFile.name}</span>
                </div>
              ) : (
                <>
                  <Upload size={24} style={{ color: 'var(--text-secondary)', marginBottom: '6px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to upload PDF</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Your resume file</div>
                </>
              )}
            </div>
            <input
              ref={compatFileRef}
              id="compat-file-input"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) { setCompatFile(f); setCompatResult(null); setCompatError(''); }
              }}
            />
          </div>

          {/* JD Input — Tabbed */}
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '10px', letterSpacing: '0.05em' }}>
              JOB DESCRIPTION
            </div>

            {/* Tab toggle */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(['paste', 'pdf'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setJdMode(mode); setCompatResult(null); setCompatError(''); }}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    transition: 'all 0.18s ease',
                    background: jdMode === mode ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                    color: jdMode === mode ? '#fff' : 'var(--text-secondary)',
                    boxShadow: jdMode === mode ? '0 0 12px rgba(16,185,129,0.35)' : 'none',
                  }}
                >
                  {mode === 'paste' ? '✏️ Paste Text' : '📄 Upload PDF'}
                </button>
              ))}
            </div>

            {/* Paste mode */}
            {jdMode === 'paste' && (
              <textarea
                id="compat-jd-input"
                className="form-control"
                style={{ height: '108px', resize: 'none', fontSize: '0.85rem', lineHeight: 1.5 }}
                placeholder={"Paste the full job description here...\n\nExample: \"We are looking for a Python engineer with 3+ years of FastAPI, PostgreSQL, and Docker experience...\""}
                value={compatJD}
                onChange={(e) => { setCompatJD(e.target.value); setCompatResult(null); setCompatError(''); }}
              />
            )}

            {/* PDF upload mode */}
            {jdMode === 'pdf' && (
              <>
                <div
                  className="compat-drop-zone"
                  style={{ height: '108px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => jdFileRef.current?.click()}
                >
                  {compatJDFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-cyan)' }}>
                      <FileText size={18} />
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{compatJDFile.name}</span>
                    </div>
                  ) : (
                    <>
                      <Upload size={22} style={{ color: 'var(--text-secondary)', marginBottom: '6px' }} />
                      <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Click to upload JD PDF</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Job description file</div>
                    </>
                  )}
                </div>
                <input
                  ref={jdFileRef}
                  id="compat-jd-file-input"
                  type="file"
                  accept=".pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setCompatJDFile(f); setCompatResult(null); setCompatError(''); }
                  }}
                />
              </>
            )}
          </div>
        </div>

        {compatError && (
          <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: 'var(--accent-rose)', padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.85rem' }}>
            {compatError}
          </div>
        )}

        <button
          id="check-compatibility-btn"
          className="btn btn-primary"
          onClick={handleCompatCheck}
          disabled={!isCompatReady || compatLoading}
          style={{ marginBottom: compatResult ? '32px' : '0' }}
        >
          {compatLoading ? (
            <>
              <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
              <span>Analysing compatibility...</span>
            </>
          ) : (
            <>
              <Briefcase size={17} />
              <span>Check Compatibility</span>
            </>
          )}
        </button>

        <style dangerouslySetInnerHTML={{ __html: `@keyframes spin { to { transform: rotate(360deg); } }` }} />

        {/* Results */}
        {compatResult && (
          <div className="compat-result">
            {/* Score row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '28px', padding: '24px', background: 'rgba(255,255,255,0.03)', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '24px' }}>
              <ScoreRing score={compatResult.score} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.08em', marginBottom: '6px' }}>COMPATIBILITY SCORE</div>
                <div style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1.5, color: 'var(--text-primary)' }}>
                  {compatResult.summary}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
              {/* Matched Skills */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    MATCHED SKILLS ({compatResult.matched_skills.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {compatResult.matched_skills.map((skill: string, i: number) => (
                    <span key={i} className="skill-tag-match">{skill}</span>
                  ))}
                </div>
              </div>

              {/* Missing Skills */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <XCircle size={16} style={{ color: '#f43f5e' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                    MISSING SKILLS ({compatResult.missing_skills.length})
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {compatResult.missing_skills.map((skill: string, i: number) => (
                    <span key={i} className="skill-tag-miss">{skill}</span>
                  ))}
                </div>
              </div>
            </div>

            {/* Suggestions */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                <Lightbulb size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                  IMPROVEMENT SUGGESTIONS
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {compatResult.suggestions.map((tip: string, i: number) => (
                  <div key={i} className="suggestion-item">
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b', minWidth: '20px', paddingTop: '1px' }}>{i + 1}.</span>
                    <span style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
