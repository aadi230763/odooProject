/**
 * Forgot Password page
 *
 * Stub — sends the email to the backend (which returns 200 without sending mail
 * in this phase) and always shows the same ambiguous success message so we don't
 * leak whether an email exists.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { Button, Input } from '../../components/ui';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validate = (value: string) => {
    if (!value.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      return 'Enter a valid email address.';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    if (err) {
      setEmailError(err);
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(email.trim());
    } catch {
      // Swallow — always show the same message to avoid email enumeration
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" role="main">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo__mark" aria-hidden="true">
            AF
          </div>
          <h1 className="auth-logo__title">
            Asset<span>Flow</span>
          </h1>
          <p className="auth-subtitle">Reset your password</p>
        </div>

        {submitted ? (
          <div
            style={{
              textAlign: 'center',
              padding: 'var(--sp-4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
            }}
            role="status"
            aria-live="polite"
            id="forgot-password-success"
          >
            <div style={{ fontSize: '2.5rem' }}>📧</div>
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
              }}
            >
              If an account exists for{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>,
              you&apos;ll receive a reset link shortly.
            </p>
          </div>
        ) : (
          <form
            className="auth-form"
            onSubmit={handleSubmit}
            noValidate
            aria-label="Forgot password form"
            id="forgot-password-form"
          >
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: 'var(--text-sm)',
                marginTop: '-var(--sp-2)',
              }}
            >
              Enter your work email and we&apos;ll send you a link to reset your
              password.
            </p>

            <Input
              id="forgot-email"
              label="Work email"
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@company.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError('');
              }}
              error={emailError}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              loading={loading}
              id="btn-forgot-submit"
            >
              Send Reset Link
            </Button>
          </form>
        )}

        <p className="auth-link-row">
          <Link to="/login" id="link-back-login">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
