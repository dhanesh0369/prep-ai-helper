const BASE_URL = 'http://localhost:8000/api';

export const getAuthToken = () => localStorage.getItem('token');
export const setAuthToken = (token: string) => localStorage.setItem('token', token);
export const removeAuthToken = () => localStorage.removeItem('token');

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(errorBody.detail || 'An unknown error occurred.');
  }

  return response.json();
}

// Auth API Calls
export async function loginUser(email: string, password: string) {
  const params = new URLSearchParams();
  params.append('username', email);
  params.append('password', password);

  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Login failed' }));
    throw new Error(errorBody.detail || 'Incorrect email or password');
  }

  const data = await response.json();
  setAuthToken(data.access_token);
  return data;
}

export function registerUser(payload: any) {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser() {
  return request('/auth/me');
}

// Resume API Calls
export async function uploadResumeFile(file: File) {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}/resume/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(errorBody.detail || 'Failed to parse resume.');
  }

  return response.json();
}

// Interview API Calls
export function startNewInterview(payload: any) {
  return request('/interview/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function submitMockInterview(interviewId: number, payload: any) {
  return request(`/interview/${interviewId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export function fetchInterviewHistory() {
  return request('/interview/history');
}

export function fetchInterviewReport(interviewId: number) {
  return request(`/interview/${interviewId}/report`);
}

export function generateFollowUp(questionText: string, userAnswer: string, interviewType: string) {
  return request('/interview/followup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question_text: questionText,
      user_answer: userAnswer,
      interview_type: interviewType
    })
  });
}

export async function checkResumeCompatibility(
  file: File,
  jobDescription: string,
  jdFile?: File | null
) {
  const token = getAuthToken();
  const formData = new FormData();
  formData.append('file', file);

  if (jdFile) {
    formData.append('jd_file', jdFile);
  } else {
    formData.append('job_description', jobDescription);
  }

  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}/resume/compatibility`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ detail: 'Compatibility check failed' }));
    throw new Error(errorBody.detail || 'Failed to analyze compatibility.');
  }

  return response.json();
}


