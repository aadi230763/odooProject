/**
 * Login page
 *
 * - Client-side validation (email format, required fields)
 * - Submits to /api/auth/login → sets session on success
 * - Surfaces field-level errors from the backend inline
 * - Redirects to /dashboard on success
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!form.password) {
    errors.password = 'Password is required.';
  }
  return errors;
}

export function LoginPage() {
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear error on change
    setErrors((prev) => ({ ...prev, [name]: undefined, general: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    try {
      const { user, token } = await authApi.login({
        email: form.email.trim(),
        password: form.password,
      });
      setSession(user, token);
      toast.success('Welcome back!', `Signed in as ${user.name}.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'INVALID_CREDENTIALS') {
          setErrors({ general: 'Incorrect email or password.' });
        } else if (err.code === 'ACCOUNT_INACTIVE') {
          setErrors({ general: 'Your account has been deactivated. Contact your admin.' });
        } else if (err.fields) {
          setErrors(err.fields as FormErrors);
        } else {
          setErrors({ general: err.message });
        }
      } else {
        setErrors({ general: 'Network error. Please try again.' });
      }
    } finally {
      setLoading(false);
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
          <p className="auth-subtitle">Enterprise Asset &amp; Resource Management</p>
        </div>

        {/* General error */}
        {errors.general && (
          <div className="auth-alert" role="alert" aria-live="assertive" id="login-error">
            {errors.general}
          </div>
        )}

        {/* Form */}
        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Sign in form"
          id="login-form"
        >
          <Input
            id="login-email"
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label className="field-label" htmlFor="login-password">
                Password
              </label>
              <Link
                to="/forgot-password"
                style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)' }}
                tabIndex={-1}
              >
                Forgot password?
              </Link>
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className={`field-input${errors.password ? ' field-input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={form.password}
                onChange={handleChange}
                style={{ paddingRight: '42px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  fontSize: '0.95rem',
                  padding: 0,
                  lineHeight: 1,
                }}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && (
              <p className="field-error" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            id="btn-login"
          >
            Sign In
          </Button>
        </form>

        <p className="auth-link-row">
          Don&apos;t have an account?{' '}
          <Link to="/signup" id="link-signup">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
