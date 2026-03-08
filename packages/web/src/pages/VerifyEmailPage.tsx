import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { ENDPOINTS } from '../api/endpoints.js';

type Status = 'loading' | 'success' | 'error';

export function VerifyEmailPage() {
  const { search } = useLocation();
  const token = new URLSearchParams(search).get('token');
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('No verification token found. Please use the link from your email.');
      return;
    }
    api
      .get<{ message: string }>(
        `${ENDPOINTS.auth.verifyEmail}?token=${encodeURIComponent(token)}`,
      )
      .then((data) => {
        setMessage(data.message);
        setStatus('success');
      })
      .catch((err: Error) => {
        setMessage(err.message || 'Verification failed. The link may have expired.');
        setStatus('error');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-surface-alt flex items-center justify-center px-4">
      <div className="bg-surface rounded-xl shadow-sm border border-border w-full max-w-md p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4" />
            <h1 className="text-xl font-bold text-text-primary">Verifying your email...</h1>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Email Verified!</h1>
            <p className="text-text-secondary text-sm mb-6">{message}</p>
            <Link
              to="/portal-login"
              className="inline-block bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Go to Login
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="h-12 w-12 rounded-full bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <svg className="h-6 w-6 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-text-primary mb-2">Verification Failed</h1>
            <p className="text-text-secondary text-sm mb-6">{message}</p>
            <Link
              to="/portal-register"
              className="inline-block bg-primary text-white px-6 py-2 rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Register Again
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
