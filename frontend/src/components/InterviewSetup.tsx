import React, { useState } from 'react';
import { startNewInterview } from '../services/api';
import { Settings, Play, ArrowLeft, Briefcase, ChevronDown, ChevronUp } from 'lucide-react';

interface InterviewSetupProps {
  resumeId: number | null;
  onBack: () => void;
  onInterviewStarted: (interviewId: number, questions: any[], type: string, difficulty: string, timeLimit: number | null) => void;
}

export default function InterviewSetup({ resumeId, onBack, onInterviewStarted }: InterviewSetupProps) {
  const [type, setType] = useState('Technical');
  const [difficulty, setDifficulty] = useState('Medium');
  const [isTimed, setIsTimed] = useState(false);
  const [timeLimit, setTimeLimit] = useState(120);
  const [jobDescription, setJobDescription] = useState('');
  const [showJD, setShowJD] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleStart = async () => {
    setLoading(true);
    setError('');

    try {
      const session = await startNewInterview({
        resume_id: resumeId,
        type,
        difficulty,
        job_description: jobDescription.trim() || null
      });
      onInterviewStarted(
        session.interview_id,
        session.questions,
        session.type,
        session.difficulty,
        isTimed ? timeLimit : null
      );
    } catch (err: any) {
      setError(err.message || 'Failed to start interview. Make sure your API keys are configured.');
    } finally {
      setLoading(false);
    }
  };

  const jdWordCount = jobDescription.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="container" style={{ maxWidth: '600px', padding: '60px 24px' }}>
      <button className="nav-link-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <ArrowLeft size={16} />
        <span>Back to Dashboard</span>
      </button>

      <div className="card glass-panel">
        <h2 className="card-title">
          <Settings size={20} className="text-cyan" />
          <span>Configure Mock Session</span>
        </h2>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: 'var(--accent-rose)',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '20px',
            fontSize: '0.85rem'
          }}>
            {error}
          </div>
        )}

        <div className="form-group">
          <label>Interview Topic / Focus</label>
          <select
            className="form-control select-control"
            value={type}
            onChange={(e) => setType(e.target.value)}
            disabled={loading}
          >
            <option value="Technical">Technical (Fullstack/Backend)</option>
            <option value="HR">HR Round (Intro & General)</option>
            <option value="Behavioral">Behavioral (STAR Method Focus)</option>
            <option value="System Design">System Design & Scale</option>
            <option value="DSA">Data Structures & Algorithms</option>
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: '24px' }}>
          <label>Difficulty Rating</label>
          <select
            className="form-control select-control"
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
            disabled={loading}
          >
            <option value="Easy">Easy (Junior Developer)</option>
            <option value="Medium">Medium (Mid-Level Practitioner)</option>
            <option value="Hard">Hard (Senior Architect)</option>
          </select>
        </div>

        {/* Timed Mode Toggle */}
        <div className="form-group" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255, 255, 255, 0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enable Timed Mode</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Add time pressure to mimic real interviews</span>
            </div>
            <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '48px', height: '24px' }}>
              <input
                type="checkbox"
                checked={isTimed}
                onChange={(e) => setIsTimed(e.target.checked)}
                disabled={loading}
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span className="slider" style={{
                position: 'absolute', cursor: 'pointer', inset: 0,
                backgroundColor: isTimed ? 'var(--accent-cyan)' : 'var(--bg-tertiary)',
                borderRadius: '24px', transition: '0.3s',
                boxShadow: isTimed ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
              }}>
                <span className="slider-knob" style={{
                  position: 'absolute', content: '""', height: '18px', width: '18px',
                  left: isTimed ? '26px' : '3px', bottom: '3px',
                  backgroundColor: '#fff', borderRadius: '50%', transition: '0.3s'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Timed Mode Dropdown */}
        {isTimed && (
          <div className="form-group" style={{ marginBottom: '24px', animation: 'fadeIn 0.2s ease' }}>
            <label>Time Limit Per Question</label>
            <select
              className="form-control select-control"
              value={timeLimit}
              onChange={(e) => setTimeLimit(parseInt(e.target.value))}
              disabled={loading}
            >
              <option value={45}>45 Seconds (Rapid Fire)</option>
              <option value={60}>1 Minute</option>
              <option value={120}>2 Minutes (Recommended)</option>
              <option value={180}>3 Minutes</option>
              <option value={300}>5 Minutes (Extended)</option>
            </select>
          </div>
        )}

        {/* JD Targeting Section */}
        <div style={{ marginBottom: '28px' }}>
          <button
            type="button"
            id="toggle-jd-btn"
            onClick={() => setShowJD(!showJD)}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: showJD
                ? 'rgba(16, 185, 129, 0.08)'
                : 'var(--bg-tertiary)',
              border: `1px solid ${showJD ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)'}`,
              borderRadius: '12px',
              padding: '12px 16px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              color: 'var(--text-primary)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Briefcase size={16} style={{ color: 'var(--accent-cyan)', flexShrink: 0 }} />
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  Target a Job Description
                  {jobDescription.trim() && (
                    <span style={{
                      marginLeft: '8px',
                      fontSize: '0.72rem',
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: 'var(--accent-cyan)',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontWeight: 700
                    }}>
                      {jdWordCount} words
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Paste a JD to get role-specific questions
                </div>
              </div>
            </div>
            {showJD ? <ChevronUp size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />}
          </button>

          {showJD && (
            <div style={{
              marginTop: '12px',
              animation: 'fadeIn 0.2s ease'
            }}>
              <textarea
                id="job-description-input"
                className="form-control"
                style={{ minHeight: '180px', resize: 'vertical', lineHeight: 1.6, fontSize: '0.875rem' }}
                placeholder={`Paste the full job description here...\n\nExample:\n"We are looking for a Python backend engineer with experience in FastAPI, PostgreSQL, and Docker. The ideal candidate has 3+ years of experience building RESTful APIs..."`}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                disabled={loading}
              />
              {jobDescription.trim() && (
                <p style={{ fontSize: '0.75rem', color: 'var(--accent-cyan)', marginTop: '6px' }}>
                  ✓ AI will tailor all 5 questions to match this specific role's requirements
                </p>
              )}
            </div>
          )}
        </div>

        <button
          className="btn btn-primary"
          style={{ width: '100%', padding: '14px 24px' }}
          onClick={handleStart}
          disabled={loading}
          id="launch-interview-btn"
        >
          {loading ? (
            <span>Generating questions using AI...</span>
          ) : (
            <>
              <Play size={18} />
              <span>Launch Mock Interview</span>
            </>
          )}
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}} />
    </div>
  );
}
