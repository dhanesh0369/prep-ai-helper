import React, { useState } from 'react';
import {
  ArrowLeft, Award, ThumbsUp, HelpCircle, ChevronDown, ChevronUp,
  Clipboard, CheckCircle2, Target, AlertTriangle, Printer, BookOpen
} from 'lucide-react';

interface InterviewReportProps {
  reportData: any;
  onBack: () => void;
}

export default function InterviewReport({ reportData, onBack }: InterviewReportProps) {
  const [openAccordion, setOpenAccordion] = useState<number | null>(0); // Open first question by default
  const [activeTabs, setActiveTabs] = useState<{ [qIndex: number]: 'compare' | 'critique' }>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const overallScore = Math.round(reportData.overall_score);
  
  // Rating thresholds
  let scoreClass = 'score-low';
  let ratingLabel = 'Needs Review';
  let ratingColor = '#f43f5e';
  
  if (overallScore >= 80) {
    scoreClass = 'score-high';
    ratingLabel = 'Exemplary';
    ratingColor = '#10b981';
  } else if (overallScore >= 60) {
    scoreClass = 'score-mid';
    ratingLabel = 'Proficient';
    ratingColor = '#f59e0b';
  }

  const listItems = reportData.questions || reportData.detailed_feedback || [];

  // Identify weak areas (score < 75) to compile custom Roadmap
  const weakTopics = listItems.filter((item: any) => item.score < 75);

  const handleCopyIdeal = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper to parse follow-ups out of the combined response
  const parseAnswer = (rawAnswer: string) => {
    if (!rawAnswer) return { main: 'No response provided.', followUp: null };
    const parts = rawAnswer.split('\n\n[Follow-up] ');
    return {
      main: parts[0],
      followUp: parts[1] || null
    };
  };

  return (
    <div className="container" style={{ padding: '40px 24px', maxWidth: '1000px' }}>
      {/* CSS Rules with High-Fidelity Print Layout overrides */}
      <style dangerouslySetInnerHTML={{__html: `
        .print-only {
          display: none;
        }

        @media print {
          /* Hide interactive components */
          .navbar, .no-print, .accordion-arrow {
            display: none !important;
          }
          
          /* Show static PDF-optimized elements */
          .print-only {
            display: block !important;
          }
          
          body {
            background: #ffffff !important;
            color: #0d1117 !important;
            font-family: system-ui, -apple-system, sans-serif !important;
          }
          
          /* Layout improvements */
          .glass-panel {
            background: #ffffff !important;
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            color: #0d1117 !important;
            margin-bottom: 20px !important;
            padding: 24px !important;
          }

          /* Force single-column list for printed Roadmap grid */
          .roadmap-grid {
            display: flex !important;
            flex-direction: column !important;
            gap: 16px !important;
          }
          
          p, span, div, h1, h2, h3, label, strong {
            color: #0d1117 !important;
          }
          
          /* Clean Page Breaks */
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          /* Printed boxes coloring for contrast on white paper */
          .print-badge {
            border: 2px solid #0d1117 !important;
            color: #0d1117 !important;
            background: #f8fafc !important;
            font-weight: 800 !important;
          }
          .print-response-box {
            background: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            font-size: 0.88rem !important;
          }
          .print-critique-box {
            background: #fef2f2 !important;
            border: 1px solid #fca5a5 !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            font-size: 0.88rem !important;
          }
          .print-ideal-box {
            background: #f0fdf4 !important;
            border: 1px solid #86efac !important;
            padding: 12px 16px !important;
            border-radius: 8px !important;
            font-size: 0.88rem !important;
          }
        }
        
        .report-tab-btn {
          padding: 8px 16px;
          font-size: 0.8rem;
          font-weight: 700;
          border: none;
          background: transparent;
          color: var(--text-secondary);
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .report-tab-btn.active {
          color: var(--accent-cyan);
          border-bottom-color: var(--accent-cyan);
        }
        .ideal-box {
          font-size: 0.9rem;
          line-height: 1.6;
          color: var(--text-primary);
          background: rgba(16, 185, 129, 0.03);
          border: 1px solid rgba(16, 185, 129, 0.12);
          padding: 18px;
          border-radius: 12px;
          position: relative;
        }
        .accordion-header:hover {
          background: rgba(255, 255, 255, 0.02) !important;
        }
      `}} />

      {/* Action Header */}
      <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <button className="nav-link-btn" onClick={onBack} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ArrowLeft size={16} />
          <span>Return to Dashboard</span>
        </button>

        <button 
          className="btn" 
          onClick={handlePrint}
          style={{ 
            background: 'var(--bg-tertiary)', 
            border: '1px solid var(--border-color)', 
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            borderRadius: '10px'
          }}
        >
          <Printer size={16} />
          <span>Print / Save PDF</span>
        </button>
      </div>

      {/* Main Scorecard Review Card */}
      <div className="card glass-panel" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '32px', padding: '40px', marginBottom: '32px' }}>
        {/* Left Side Score ring */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderRight: '1px solid var(--border-color)', paddingRight: '24px' }}>
          <div style={{ position: 'relative', width: '130px', height: '130px', marginBottom: '16px' }}>
            <svg width="130" height="130" style={{ transform: 'rotate(-90deg)' }}>
              <circle
                cx="65" cy="65" r="58"
                fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="8"
              />
              <circle
                cx="65" cy="65" r="58"
                fill="none" stroke={ratingColor} strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 58}`}
                strokeDashoffset={`${2 * Math.PI * 58 * (1 - overallScore / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: ratingColor, lineHeight: 1 }}>{overallScore}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ 100</span>
            </div>
          </div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: '0.1em', marginBottom: '4px' }}>RATING</div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: ratingColor }}>{ratingLabel}</div>
        </div>

        {/* Right Side Review Content */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '6px', color: 'var(--accent-cyan)' }}>
              {reportData.type} Round
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Difficulty: <strong>{reportData.difficulty}</strong>
            </span>
          </div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '12px', letterSpacing: '-0.02em' }}>Performance Review</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, fontSize: '0.95rem' }}>
            {reportData.overall_feedback || "Analysis complete. Review specific question highlights and suggestions below."}
          </p>
        </div>
      </div>

      {/* Dynamic Learning Roadmap (only if weaknesses exist) */}
      {weakTopics.length > 0 && (
        <div className="card glass-panel" style={{ borderLeft: '4px solid var(--accent-purple)', padding: '24px 32px', marginBottom: '32px' }}>
          <h2 className="card-title" style={{ color: 'var(--accent-purple)', marginBottom: '8px' }}>
            <Award size={20} />
            <span>Personalized Learning Roadmap</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
            Based on your lower-scoring answers, we recommend focusing on these topics:
          </p>

          <div className="roadmap-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {weakTopics.map((item: any, idx: number) => (
              <div key={idx} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(168, 85, 247, 0.04)',
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid rgba(168, 85, 247, 0.15)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--text-primary)'
              }}>
                <span style={{ color: 'var(--accent-purple)', fontWeight: 800 }}>{idx + 1}.</span>
                <span>{item.topic || 'Core Concept'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SCREEN ONLY SECTION (Interactive Accordions) ── */}
      <div className="no-print">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '40px 0 20px' }}>
          <BookOpen size={20} style={{ color: 'var(--accent-cyan)' }} />
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, letterSpacing: '-0.019em' }}>Detailed Transcript</h2>
        </div>
        
        {listItems.map((item: any, index: number) => {
          const isOpen = openAccordion === index;
          const qScore = Math.round(item.score);
          const itemScoreClass = qScore >= 80 ? 'score-high' : qScore >= 60 ? 'score-mid' : 'score-low';
          
          const currentTab = activeTabs[index] || 'compare';
          const parsed = parseAnswer(item.user_answer);

          return (
            <div key={index} className="glass-panel" style={{ marginBottom: '16px', overflow: 'hidden', border: isOpen ? '1px solid var(--border-color)' : '1px solid transparent' }}>
              {/* Accordion Trigger Header */}
              <div
                className="accordion-header"
                onClick={() => setOpenAccordion(isOpen ? null : index)}
                style={{
                  padding: '20px 24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: isOpen ? 'rgba(255,255,255,0.02)' : 'none',
                  transition: 'background 0.25s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, paddingRight: '12px' }}>
                  {/* Clean Cyan Question Number Circle */}
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'rgba(6, 182, 212, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent-cyan)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    flexShrink: 0
                  }}>
                    {index + 1}
                  </div>
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.4, color: 'var(--text-primary)' }}>{item.question_text}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <span className={`score-badge ${itemScoreClass}`} style={{ width: '40px', height: '40px', borderRadius: '10px', fontSize: '0.95rem' }}>
                    {qScore}
                  </span>
                  <span className="accordion-arrow">
                    {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </span>
                </div>
              </div>

              {/* Accordion Collapsible Panel */}
              {isOpen && (
                <div style={{
                  padding: '24px',
                  borderTop: '1px solid var(--border-color)',
                  background: 'rgba(7, 9, 19, 0.4)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px'
                }}>
                  {/* Tab Controls */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', gap: '16px', marginBottom: '8px' }}>
                    <button
                      className={`report-tab-btn ${currentTab === 'compare' ? 'active' : ''}`}
                      onClick={() => setActiveTabs({ ...activeTabs, [index]: 'compare' })}
                    >
                      📝 Response Comparison
                    </button>
                    <button
                      className={`report-tab-btn ${currentTab === 'critique' ? 'active' : ''}`}
                      onClick={() => setActiveTabs({ ...activeTabs, [index]: 'critique' })}
                    >
                      💡 Critique & Gaps
                    </button>
                  </div>

                  {/* Tab 1: Response Comparison */}
                  {currentTab === 'compare' && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                      {/* User response box */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <CheckCircle2 size={15} style={{ color: 'var(--accent-cyan)' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-cyan)', letterSpacing: '0.05em' }}>YOUR INITIAL RESPONSE</span>
                        </div>
                        <div style={{
                          fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)',
                          background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)',
                          padding: '16px', borderRadius: '12px', minHeight: '120px', whiteSpace: 'pre-wrap'
                        }}>
                          {parsed.main}
                        </div>

                        {/* Display follow-up reply separately if it was recorded */}
                        {parsed.followUp && (
                          <div style={{ marginTop: '16px', animation: 'fadeIn 0.3s ease' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                              <CheckCircle2 size={15} style={{ color: 'var(--accent-purple)' }} />
                              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-purple)', letterSpacing: '0.05em' }}>FOLLOW-UP RESPONSE</span>
                            </div>
                            <div style={{
                              fontSize: '0.88rem', lineHeight: 1.6, color: 'var(--text-primary)',
                              background: 'rgba(168,85,247,0.02)', border: '1px solid rgba(168,85,247,0.15)',
                              padding: '16px', borderRadius: '12px', minHeight: '80px', whiteSpace: 'pre-wrap'
                            }}>
                              {parsed.followUp}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Ideal exemplar box */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                          <Target size={15} style={{ color: 'var(--accent-emerald)' }} />
                          <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-emerald)', letterSpacing: '0.05em' }}>IDEAL EXEMPLAR RESPONSE</span>
                          
                          <button
                            className="no-print"
                            onClick={() => handleCopyIdeal(item.ideal_answer, index)}
                            style={{
                              marginLeft: 'auto', background: 'none', border: 'none',
                              color: copiedIndex === index ? '#10b981' : 'var(--text-secondary)',
                              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
                              fontSize: '0.72rem', fontWeight: 700
                            }}
                          >
                            <Clipboard size={12} />
                            <span>{copiedIndex === index ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="ideal-box" style={{ minHeight: '120px' }}>
                          {item.ideal_answer || "No ideal answer provided."}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Critique & Gaps */}
                  {currentTab === 'critique' && (
                    <div style={{
                      padding: '20px', borderRadius: '12px',
                      background: qScore >= 75 ? 'rgba(16,185,129,0.02)' : 'rgba(244,63,94,0.02)',
                      border: `1px solid ${qScore >= 75 ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                        <ThumbsUp size={16} style={{ color: 'var(--accent-emerald)' }} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: qScore >= 75 ? 'var(--accent-emerald)' : 'var(--accent-rose)', letterSpacing: '0.05em' }}>
                          AI EVALUATION & KEY GAPS
                        </span>
                      </div>
                      <p style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
                        {item.feedback || item.critique || "Critique analysis not provided."}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── PRINT ONLY SECTION (Fully Expanded static view of all 5 questions) ── */}
      <div className="print-only">
        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: '30px 0 20px', borderBottom: '2px solid #0d1117', paddingBottom: '8px' }}>
          Detailed Performance Transcript
        </h2>

        {listItems.map((item: any, index: number) => {
          const qScore = Math.round(item.score);
          const parsed = parseAnswer(item.user_answer);

          return (
            <div key={index} className="glass-panel page-break-avoid" style={{ marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '20px' }}>
              {/* Question title and score badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, flex: 1, paddingRight: '16px', lineHeight: 1.4 }}>
                  Question {index + 1}: {item.question_text}
                </h3>
                <span className="print-badge" style={{ 
                  padding: '6px 12px', border: '1px solid #0d1117', borderRadius: '6px', 
                  fontSize: '0.9rem', fontWeight: 800, minWidth: '48px', textAlign: 'center' 
                }}>
                  Score: {qScore}
                </span>
              </div>

              {/* Stacked Content sections */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
                {/* 1. Initial response */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    YOUR RESPONSE
                  </div>
                  <div className="print-response-box" style={{ whiteSpace: 'pre-wrap' }}>
                    {parsed.main}
                  </div>
                </div>

                {/* 2. Follow-up response (if any) */}
                {parsed.followUp && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '4px' }}>
                      FOLLOW-UP RESPONSE
                    </div>
                    <div className="print-response-box" style={{ whiteSpace: 'pre-wrap' }}>
                      {parsed.followUp}
                    </div>
                  </div>
                )}

                {/* 3. AI Critique */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    AI EVALUATION & KEY GAPS
                  </div>
                  <div className="print-critique-box">
                    {item.feedback || item.critique || "Critique analysis not provided."}
                  </div>
                </div>

                {/* 4. Ideal Exemplar */}
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#475569', letterSpacing: '0.05em', marginBottom: '4px' }}>
                    IDEAL EXEMPLAR ANSWER
                  </div>
                  <div className="print-ideal-box">
                    {item.ideal_answer}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
