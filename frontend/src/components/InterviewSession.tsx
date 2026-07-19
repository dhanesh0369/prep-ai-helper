import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, Send, AlertCircle, Mic, MicOff, Square, Volume2, VolumeX, MessageCircle, Loader2 } from 'lucide-react';
import { submitMockInterview, generateFollowUp } from '../services/api';

// Extend Window type to include SpeechRecognition
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

interface InterviewSessionProps {
  interviewId: number;
  questions: any[];
  type: string;
  difficulty: string;
  timeLimit?: number | null;
  onInterviewCompleted: (evaluation: any) => void;
}

export default function InterviewSession({
  interviewId,
  questions,
  type,
  difficulty,
  timeLimit = null,
  onInterviewCompleted
}: InterviewSessionProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<{ [qId: number]: string }>({});
  const [currentAnswer, setCurrentAnswer] = useState('');

  // Total session timer state
  const [seconds, setSeconds] = useState(0);

  // Question countdown state
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [showTimesUp, setShowTimesUp] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Voice input state
  const [isListening, setIsListening] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  // Track typed text before voice started, and all confirmed final segments
  const typedBeforeVoiceRef = useRef('');
  const finalSegmentsRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);

  // TTS state
  const [ttsSupported, setTtsSupported] = useState(false);
  const [autoRead, setAutoRead] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Follow-up question state
  const [followUpQuestion, setFollowUpQuestion] = useState<string | null>(null);
  const [followUpAnswer, setFollowUpAnswer] = useState('');
  const [followUpLoading, setFollowUpLoading] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  // Delivery metadata state map
  const [deliveryMetadataMap, setDeliveryMetadataMap] = useState<{
    [qId: number]: {
      wpm: number;
      filler_count: number;
      volume_status: string;
    }
  }>({});

  // Audio context and analysis refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const volumeValuesRef = useRef<number[]>([]);
  const audioIntervalRef = useRef<any>(null);

  const recordingStartTimeRef = useRef<number | null>(null);
  const speakingDurationRef = useRef<number>(0);

  // Check browser support and set up SpeechRecognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setVoiceSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let interim = '';
        // Only process truly new results starting from resultIndex
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            // Store each final segment only once by its index
            finalSegmentsRef.current[i] = transcript;
          } else {
            interim = transcript;
          }
        }
        // Rebuild the full answer from typed prefix + all unique final segments
        const voicePart = finalSegmentsRef.current.filter(Boolean).join(' ');
        const combined = (typedBeforeVoiceRef.current + (typedBeforeVoiceRef.current && voicePart ? ' ' : '') + voicePart).trimStart();
        setCurrentAnswer(combined);
        setInterimTranscript(interim);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
      };

      recognition.onerror = (event: any) => {
        if (event.error !== 'no-speech') {
          setError(`Microphone error: ${event.error}. Please check your browser permissions.`);
        }
        setIsListening(false);
        setInterimTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Stop listening and reset voice state when question changes
  useEffect(() => {
    stopListening();
    typedBeforeVoiceRef.current = '';
    finalSegmentsRef.current = [];
    speakingDurationRef.current = 0;
    volumeValuesRef.current = [];
  }, [currentIndex]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setError('');
    // Snapshot whatever the user has already typed
    typedBeforeVoiceRef.current = currentAnswer.trimEnd();
    // Clear old voice segments for this new recording session
    finalSegmentsRef.current = [];
    setIsListening(true);

    // Track speech duration start
    recordingStartTimeRef.current = Date.now();

    // Set up Web Audio Analyser
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          microphoneStreamRef.current = stream;
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            const ctx = new AudioContextClass();
            audioContextRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 256;
            source.connect(analyser);
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            audioIntervalRef.current = setInterval(() => {
              if (analyserRef.current) {
                analyserRef.current.getByteFrequencyData(dataArray);
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const average = sum / bufferLength;
                volumeValuesRef.current.push(average);
              }
            }, 100);
          }
        })
        .catch((err) => {
          console.warn('Web Audio capture failed:', err);
        });
    }

    try {
      recognitionRef.current.start();
    } catch (e) {
      // already started
    }
  }, [currentAnswer]);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    setIsListening(false);
    setInterimTranscript('');

    // Compute duration
    if (recordingStartTimeRef.current) {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      speakingDurationRef.current += elapsed;
      recordingStartTimeRef.current = null;
    }

    // Clean up Web Audio refs
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    try {
      recognitionRef.current.stop();
    } catch (e) {
      // already stopped
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Increment total session timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync remaining seconds with current question / timeLimit setting
  useEffect(() => {
    if (timeLimit) {
      setTimeLeft(timeLimit);
    } else {
      setTimeLeft(null);
    }
  }, [currentIndex, timeLimit]);

  // Keep ref of currentAnswer for timeUp callback
  const currentAnswerRef = useRef(currentAnswer);
  useEffect(() => {
    currentAnswerRef.current = currentAnswer;
  }, [currentAnswer]);

  // Handle countdown interval
  useEffect(() => {
    if (timeLimit === null || timeLimit === undefined) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [currentIndex, timeLimit]);

  const getDeliveryDataForActive = (answerText: string) => {
    const wpm = calculateWPM(answerText, speakingDurationRef.current);
    const fillerCount = countFillerWords(answerText);

    let volumeStatus = 'Consistent';
    if (volumeValuesRef.current.length > 0) {
      const sum = volumeValuesRef.current.reduce((a, b) => a + b, 0);
      const avg = sum / volumeValuesRef.current.length;

      const sqDiffs = volumeValuesRef.current.map(v => Math.pow(v - avg, 2));
      const variance = sqDiffs.reduce((a, b) => a + b, 0) / volumeValuesRef.current.length;
      const stdDev = Math.sqrt(variance);

      if (avg < 5) {
        volumeStatus = 'Too Quiet';
      } else if (stdDev > 25) {
        volumeStatus = 'Inconsistent';
      }
    }

    return {
      wpm,
      filler_count: fillerCount,
      volume_status: volumeStatus
    };
  };

  const calculateWPM = (text: string, durationSec: number): number => {
    if (durationSec <= 2) return 0;
    const cleanText = text.replace(/\[Follow-up\].*$/i, '');
    const wordCount = cleanText.trim().split(/\s+/).filter(Boolean).length;
    return Math.round((wordCount / durationSec) * 60);
  };

  const countFillerWords = (text: string): number => {
    if (!text) return 0;
    const matches = text.toLowerCase().match(/\b(um|uh|ah|like|basically|actually|you\s+know)\b/g);
    return matches ? matches.length : 0;
  };

  const handleTimeUp = async () => {
    stopListening();
    setShowTimesUp(true);

    const finalAnswerText = currentAnswerRef.current.trim() || "[No response submitted in time]";
    const activeQ = questions[currentIndex];

    // Compute metadata
    const metadata = getDeliveryDataForActive(finalAnswerText);
    setDeliveryMetadataMap((prev) => ({
      ...prev,
      [activeQ.id]: metadata
    }));

    setAnswers((prev) => ({
      ...prev,
      [activeQ.id]: finalAnswerText
    }));

    setTimeout(async () => {
      setShowTimesUp(false);
      if (currentIndex < questions.length - 1) {
        setCurrentAnswer('');
        setCurrentIndex((prev) => prev + 1);
      } else {
        setLoading(true);
        setError('');

        const finalAnswers = {
          ...answers,
          [activeQ.id]: finalAnswerText
        };

        const finalMetadataMap = {
          ...deliveryMetadataMap,
          [activeQ.id]: metadata
        };

        const formattedPayload = {
          answers: Object.keys(finalAnswers).map((qId) => {
            const idInt = parseInt(qId);
            return {
              question_id: idInt,
              answer_text: finalAnswers[idInt],
              delivery_metadata: finalMetadataMap[idInt] || null
            };
          })
        };

        try {
          const evaluation = await submitMockInterview(interviewId, formattedPayload);
          onInterviewCompleted(evaluation);
        } catch (err: any) {
          setError(err.message || 'Submission failed. Please check backend connection.');
          setLoading(false);
        }
      }
    }, 1800);
  };

  // ── TTS Setup ──
  useEffect(() => {
    if ('speechSynthesis' in window) {
      setTtsSupported(true);
    }
  }, []);

  const speakQuestion = useCallback((text: string) => {
    if (!ttsSupported) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.lang = 'en-US';
    // Try to pick a good voice
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) || voices.find(v => v.lang.startsWith('en'));
    if (preferred) utterance.voice = preferred;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  }, [ttsSupported]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  // Auto-read questions when they change
  useEffect(() => {
    if (autoRead && ttsSupported && !showFollowUp) {
      const q = questions[currentIndex];
      if (q) {
        // Small delay to let the UI render first
        const id = setTimeout(() => speakQuestion(q.question_text), 400);
        return () => clearTimeout(id);
      }
    }
  }, [currentIndex, autoRead, ttsSupported, showFollowUp]);

  // Auto-read follow-up questions
  useEffect(() => {
    if (autoRead && ttsSupported && followUpQuestion) {
      const id = setTimeout(() => speakQuestion(followUpQuestion), 400);
      return () => clearTimeout(id);
    }
  }, [followUpQuestion, autoRead, ttsSupported]);

  // ── Follow-up Flow ──
  const handleAnswerAndFollowUp = async () => {
    stopListening();
    stopSpeaking();
    if (!currentAnswer.trim()) return;

    const activeQuestion = questions[currentIndex];

    // Save the main answer
    setAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: currentAnswer
    }));

    // Request a follow-up question
    setFollowUpLoading(true);
    try {
      const result = await generateFollowUp(activeQuestion.question_text, currentAnswer, type);
      if (result?.follow_up_question) {
        setFollowUpQuestion(result.follow_up_question);
        setFollowUpAnswer('');
        setShowFollowUp(true);
      } else {
        // No follow-up, advance directly
        const metadata = getDeliveryDataForActive(currentAnswer);
        setDeliveryMetadataMap((prev) => ({
          ...prev,
          [activeQuestion.id]: metadata
        }));
        advanceToNextQuestion();
      }
    } catch (err) {
      console.error('Follow-up generation failed:', err);
      // Still advance if follow-up fails
      const metadata = getDeliveryDataForActive(currentAnswer);
      setDeliveryMetadataMap((prev) => ({
        ...prev,
        [activeQuestion.id]: metadata
      }));
      advanceToNextQuestion();
    } finally {
      setFollowUpLoading(false);
    }
  };

  const handleFollowUpSubmit = () => {
    stopListening();
    stopSpeaking();
    // Save follow-up answer appended to main answer
    const activeQuestion = questions[currentIndex];
    const mainAnswer = answers[activeQuestion.id] || '';
    const combined = mainAnswer + '\n\n[Follow-up] ' + (followUpAnswer.trim() || '[Skipped]');
    
    // Calculate combined metadata
    const metadata = getDeliveryDataForActive(combined);
    setDeliveryMetadataMap((prev) => ({
      ...prev,
      [activeQuestion.id]: metadata
    }));

    setAnswers((prev) => ({
      ...prev,
      [activeQuestion.id]: combined
    }));

    setShowFollowUp(false);
    setFollowUpQuestion(null);
    setFollowUpAnswer('');
    advanceToNextQuestion();
  };

  const skipFollowUp = () => {
    stopSpeaking();
    const activeQuestion = questions[currentIndex];
    const mainAnswer = answers[activeQuestion.id] || '';

    // Calculate metadata
    const metadata = getDeliveryDataForActive(mainAnswer);
    setDeliveryMetadataMap((prev) => ({
      ...prev,
      [activeQuestion.id]: metadata
    }));

    setShowFollowUp(false);
    setFollowUpQuestion(null);
    setFollowUpAnswer('');
    advanceToNextQuestion();
  };

  const advanceToNextQuestion = () => {
    setCurrentAnswer('');
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handleNext = () => {
    // If this is not the last question, trigger follow-up flow
    if (currentIndex < questions.length - 1) {
      handleAnswerAndFollowUp();
    }
  };

  const handleSubmit = async () => {
    stopListening();
    stopSpeaking();
    if (!currentAnswer.trim() && currentIndex === questions.length - 1) return;

    // For the last question, try to get a follow-up first
    if (!showFollowUp && currentAnswer.trim()) {
      const activeQuestion = questions[currentIndex];
      setAnswers((prev) => ({
        ...prev,
        [activeQuestion.id]: currentAnswer
      }));

      setFollowUpLoading(true);
      try {
        const result = await generateFollowUp(activeQuestion.question_text, currentAnswer, type);
        if (result?.follow_up_question) {
          setFollowUpQuestion(result.follow_up_question);
          setFollowUpAnswer('');
          setShowFollowUp(true);
          setFollowUpLoading(false);
          return; // Wait for follow-up answer before final submit
        }
      } catch (err) {
        console.error('Follow-up generation failed:', err);
      }
      setFollowUpLoading(false);
    }

    // Final submit
    const activeQuestion = questions[currentIndex];
    const metadata = getDeliveryDataForActive(currentAnswer);
    doFinalSubmit(metadata);
  };

  const doFinalSubmit = async (lastMetadata?: any) => {
    setLoading(true);
    setError('');

    const lastQuestion = questions[currentIndex];
    const finalAnswers = {
      ...answers,
      ...(currentAnswer.trim() ? { [lastQuestion.id]: currentAnswer } : {})
    };

    const finalMetadataMap = {
      ...deliveryMetadataMap,
      ...(lastMetadata ? { [lastQuestion.id]: lastMetadata } : {})
    };

    const formattedPayload = {
      answers: Object.keys(finalAnswers).map((qId) => {
        const idInt = parseInt(qId);
        return {
          question_id: idInt,
          answer_text: finalAnswers[idInt],
          delivery_metadata: finalMetadataMap[idInt] || null
        };
      })
    };

    try {
      const evaluation = await submitMockInterview(interviewId, formattedPayload);
      onInterviewCompleted(evaluation);
    } catch (err: any) {
      setError(err.message || 'Submission failed. Please check backend connection.');
      setLoading(false);
    }
  };

  const activeQuestion = questions[currentIndex];
  const progressPercent = ((currentIndex) / questions.length) * 100;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '100px 24px' }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid var(--border-color)',
          borderTopColor: 'var(--accent-cyan)',
          borderRadius: '50%',
          margin: '0 auto 24px',
          animation: 'spin 1s linear infinite'
        }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px' }}>Evaluating Responses...</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Our AI is scoring your answers against industry standards. Please hold on.</p>
        <style dangerouslySetInnerHTML={{__html: `@keyframes spin { to { transform: rotate(360deg); } }`}} />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="container" style={{ textAlign: 'center', padding: '60px 24px' }}>
        <AlertCircle size={40} className="text-rose" style={{ marginBottom: '16px' }} />
        <p>No questions generated. Please return to dashboard and try again.</p>
      </div>
    );
  }

  // Combined display text: confirmed answer + interim speech
  const displayValue = isListening
    ? (currentAnswer + (interimTranscript ? (currentAnswer ? ' ' : '') + interimTranscript : ''))
    : currentAnswer;

  return (
    <div className="container interview-container">
      {/* Time's Up Screen Overlay */}
      {showTimesUp && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(5, 10, 7, 0.85)',
          backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'fadeIn 0.25s ease'
        }}>
          <div style={{
            textAlign: 'center',
            padding: '40px 48px',
            borderRadius: '24px',
            background: 'var(--bg-secondary)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 30px rgba(244, 63, 94, 0.15)',
            maxWidth: '420px',
            width: '90%',
            animation: 'scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            <div style={{ fontSize: '3.5rem', marginBottom: '16px', animation: 'bounce 1s infinite' }}>⏰</div>
            <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--accent-rose)', marginBottom: '8px' }}>Time's Up!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Your response has been automatically saved. Advancing to the next question...
            </p>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.5); }
          70% { box-shadow: 0 0 0 10px rgba(244, 63, 94, 0); }
          100% { box-shadow: 0 0 0 0 rgba(244, 63, 94, 0); }
        }
        .mic-btn-active {
          animation: pulse-ring 1.5s infinite;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .recording-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-rose);
          display: inline-block;
          animation: blink 1s infinite;
        }
        .voice-textarea {
          position: relative;
        }
        .voice-textarea textarea {
          padding-right: 56px !important;
        }
        @keyframes pulse-border {
          0%, 100% { border-color: rgba(244, 63, 94, 0.2); }
          50% { border-color: rgba(244, 63, 94, 0.6); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
      `}} />

      <div className="interview-header">
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '6px' }}>
            {type} Round
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginLeft: '12px' }}>
            Difficulty: {difficulty}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* TTS Auto-Read Toggle */}
          {ttsSupported && (
            <button
              onClick={() => { setAutoRead(!autoRead); if (isSpeaking) stopSpeaking(); }}
              title={autoRead ? 'Auto-read ON — click to disable' : 'Auto-read OFF — click to enable'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '4px 10px', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700,
                transition: 'all 0.2s',
                background: autoRead ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-tertiary)',
                color: autoRead ? '#10b981' : 'var(--text-secondary)',
              }}
            >
              {autoRead ? <Volume2 size={14} /> : <VolumeX size={14} />}
              {autoRead ? 'Auto-Read' : 'Muted'}
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontWeight: 600 }}>
            <Clock size={16} />
            <span>{formatTime(seconds)}</span>
          </div>
        </div>
      </div>

      <div className="interview-body">
        {/* Visual Countdown Timer and bar */}
        {timeLimit !== null && timeLeft !== null && (
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              background: timeLeft <= 15 ? 'rgba(244, 63, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              border: `1px solid ${timeLeft <= 15 ? 'rgba(244, 63, 94, 0.25)' : 'var(--border-color)'}`,
              padding: '12px 16px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: timeLeft <= 15 ? 'pulse-border 1.5s infinite' : 'none',
              transition: 'all 0.3s ease'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1rem', animation: timeLeft <= 15 ? 'spin-slow 2s linear infinite' : 'none', display: 'inline-block' }}>⏳</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: timeLeft <= 15 ? 'var(--accent-rose)' : 'var(--text-secondary)' }}>
                  {timeLeft <= 15 ? 'HURRY! Time is running out...' : 'Question Time Limit'}
                </span>
              </div>
              <span style={{
                fontSize: '1.1rem',
                fontWeight: 800,
                color: timeLeft <= 15 ? 'var(--accent-rose)' : 'var(--text-primary)',
                fontFamily: 'monospace'
              }}>
                {formatTime(timeLeft)}
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden', marginTop: '6px' }}>
              <div style={{
                width: `${(timeLeft / timeLimit) * 100}%`,
                height: '100%',
                background: timeLeft <= 15 ? 'var(--accent-rose)' : 'var(--accent-cyan)',
                transition: 'width 1s linear'
              }} />
            </div>
          </div>
        )}

        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>

        <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '12px' }}>
          QUESTION {currentIndex + 1} OF {questions.length}
        </div>

        <div className="question-card glass-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div className="question-tag">{activeQuestion.topic}</div>
            {ttsSupported && (
              <button
                onClick={() => isSpeaking ? stopSpeaking() : speakQuestion(activeQuestion.question_text)}
                title={isSpeaking ? 'Stop reading' : 'Read question aloud'}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '5px 12px', borderRadius: '8px', border: 'none',
                  cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700,
                  transition: 'all 0.2s',
                  background: isSpeaking ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-tertiary)',
                  color: isSpeaking ? 'var(--accent-purple)' : 'var(--text-secondary)',
                }}
              >
                {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                {isSpeaking ? 'Stop' : 'Read Aloud'}
              </button>
            )}
          </div>
          <div className="question-text">{activeQuestion.question_text}</div>
        </div>

        <div className="form-group voice-textarea" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ marginBottom: 0 }}>Your Response</label>
            {voiceSupported && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {isListening && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: 'var(--accent-rose)', fontWeight: 600 }}>
                    <span className="recording-dot" />
                    Listening...
                  </span>
                )}
                <button
                  id="voice-toggle-btn"
                  onClick={toggleListening}
                  title={isListening ? 'Stop recording' : 'Speak your answer'}
                  className={isListening ? 'mic-btn-active' : ''}
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                    background: isListening
                      ? 'rgba(244, 63, 94, 0.2)'
                      : 'var(--bg-tertiary)',
                    color: isListening ? 'var(--accent-rose)' : 'var(--text-secondary)',
                    flexShrink: 0
                  }}
                >
                  {isListening ? <Square size={16} fill="currentColor" /> : <Mic size={16} />}
                </button>
              </div>
            )}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              id={`answer-textarea-${currentIndex}`}
              className="form-control"
              style={{ minHeight: '160px', resize: 'vertical', lineHeight: 1.6 }}
              placeholder={
                voiceSupported
                  ? 'Type your answer, or click the 🎤 mic button to speak...'
                  : 'Type your answer here. We recommend the STAR method for behavioral questions.'
              }
              value={displayValue}
              onChange={(e) => {
                if (!isListening) {
                  setCurrentAnswer(e.target.value);
                }
              }}
            />
            {isListening && interimTranscript && (
              <div style={{
                position: 'absolute',
                bottom: '10px',
                left: '14px',
                right: '14px',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                fontStyle: 'italic',
                pointerEvents: 'none',
                opacity: 0.7
              }}>
                {/* Visual indicator that speech is being processed */}
              </div>
            )}
          </div>

          {!voiceSupported && (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
              Voice input is not supported in your browser. Try Chrome or Edge for voice typing.
            </p>
          )}
        </div>

        {error && (
          <div style={{
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.25)',
            color: 'var(--accent-rose)',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '16px',
            fontSize: '0.85rem'
          }}>{error}</div>
        )}

        {/* Follow-Up Loading Spinner */}
        {followUpLoading && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            padding: '14px 18px', borderRadius: '12px',
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            marginBottom: '20px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <Loader2 size={18} style={{ color: 'var(--accent-purple)', animation: 'spin 1s linear infinite' }} />
            <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--accent-purple)' }}>Generating follow-up question...</span>
          </div>
        )}

        {/* Follow-Up Question Panel */}
        {showFollowUp && followUpQuestion && (
          <div style={{
            padding: '20px',
            borderRadius: '16px',
            background: 'rgba(168, 85, 247, 0.06)',
            border: '1px solid rgba(168, 85, 247, 0.2)',
            marginBottom: '20px',
            animation: 'fadeIn 0.3s ease'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <MessageCircle size={17} style={{ color: 'var(--accent-purple)' }} />
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--accent-purple)', letterSpacing: '0.05em' }}>FOLLOW-UP QUESTION</span>
              {ttsSupported && (
                <button
                  onClick={() => isSpeaking ? stopSpeaking() : speakQuestion(followUpQuestion)}
                  style={{
                    marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px', borderRadius: '6px', border: 'none',
                    cursor: 'pointer', fontSize: '0.72rem', fontWeight: 700,
                    background: isSpeaking ? 'rgba(168, 85, 247, 0.15)' : 'var(--bg-tertiary)',
                    color: isSpeaking ? 'var(--accent-purple)' : 'var(--text-secondary)',
                  }}
                >
                  {isSpeaking ? <VolumeX size={12} /> : <Volume2 size={12} />}
                  {isSpeaking ? 'Stop' : 'Listen'}
                </button>
              )}
            </div>
            <div style={{
              fontSize: '1rem', fontWeight: 600, lineHeight: 1.6,
              color: 'var(--text-primary)', marginBottom: '16px'
            }}>
              {followUpQuestion}
            </div>
            <textarea
              className="form-control"
              style={{ minHeight: '100px', resize: 'vertical', lineHeight: 1.6, marginBottom: '12px', fontSize: '0.9rem' }}
              placeholder="Type your follow-up response here..."
              value={followUpAnswer}
              onChange={(e) => setFollowUpAnswer(e.target.value)}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                className="btn"
                onClick={skipFollowUp}
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
              >
                Skip
              </button>
              {currentIndex < questions.length - 1 ? (
                <button
                  className="btn btn-primary"
                  onClick={handleFollowUpSubmit}
                  disabled={!followUpAnswer.trim()}
                  style={{ background: 'linear-gradient(135deg, var(--accent-purple), var(--accent-cyan))' }}
                >
                  <span>Answer & Continue</span>
                  <Send size={14} />
                </button>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => {
                    // Save follow-up and do final submit
                    const activeQuestion = questions[currentIndex];
                    const mainAnswer = answers[activeQuestion.id] || '';
                    const combined = mainAnswer + '\n\n[Follow-up] ' + (followUpAnswer.trim() || '[Skipped]');
                    setAnswers((prev) => ({ ...prev, [activeQuestion.id]: combined }));
                    setShowFollowUp(false);
                    setFollowUpQuestion(null);
                    setFollowUpAnswer('');
                    setTimeout(() => doFinalSubmit(), 100);
                  }}
                  disabled={!followUpAnswer.trim()}
                  style={{ background: 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))' }}
                >
                  <span>Answer & Submit All</span>
                  <Send size={14} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Main action buttons — hidden when follow-up is showing */}
        {!showFollowUp && !followUpLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            {currentIndex < questions.length - 1 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={!currentAnswer.trim()}
              >
                <span>Next Question</span>
                <Send size={16} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                style={{ background: 'linear-gradient(135deg, var(--accent-emerald), var(--accent-cyan))' }}
                onClick={handleSubmit}
                disabled={!currentAnswer.trim()}
              >
                <span>Submit & Grade Mock</span>
                <Send size={16} />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
