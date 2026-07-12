/**
 * Signup page
 *
 * - Creates an Employee account (role is always set server-side)
 * - Client-side validation: name, email format, password strength
 * - Surfaces field-level errors from the backend inline
 * - Auto-logs in and redirects to /dashboard on success
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Button, Input } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';

interface FormState {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  general?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Full name is required.';
  } else if (form.name.trim().length < 2) {
    errors.name = 'Name must be at least 2 characters.';
  }

  if (!form.email.trim()) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!form.password) {
    errors.password = 'Password is required.';
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (form.confirmPassword !== form.password) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return errors;
}

// Password strength meter
function getStrength(password: string): { level: number; label: string; color: string } {
  if (!password) return { level: 0, label: '', color: 'var(--border)' };
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { level: 1, label: 'Weak', color: 'var(--danger)' };
  if (score <= 3) return { level: 2, label: 'Fair', color: 'var(--warning)' };
  if (score <= 4) return { level: 3, label: 'Good', color: 'var(--info)' };
  return { level: 4, label: 'Strong', color: 'var(--success)' };
}

export function SignupPage() {
  const { setSession } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const strength = getStrength(form.password);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
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
      const { user, token } = await authApi.signup({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      setSession(user, token);
      toast.success('Account created!', `Welcome to AssetFlow, ${user.name}.`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'EMAIL_EXISTS') {
          setErrors({ email: 'An account with this email already exists.' });
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
      <div className="auth-card" style={{ maxWidth: '480px' }} role="main">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo__mark" aria-hidden="true">
            AF
          </div>
          <h1 className="auth-logo__title">
            Create Account
          </h1>
          <p className="auth-subtitle">Join AssetFlow as an Employee</p>
        </div>

        {errors.general && (
          <div className="auth-alert" role="alert" aria-live="assertive" id="signup-error">
            {errors.general}
          </div>
        )}

        <form
          className="auth-form"
          onSubmit={handleSubmit}
          noValidate
          aria-label="Create account form"
          id="signup-form"
        >
          <Input
            id="signup-name"
            label="Full name"
            type="text"
            name="name"
            autoComplete="name"
            autoFocus
            placeholder="Jane Smith"
            value={form.name}
            onChange={handleChange}
            error={errors.name}
          />

          <Input
            id="signup-email"
            label="Work email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={form.email}
            onChange={handleChange}
            error={errors.email}
          />

          <div className="field">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="field-label" htmlFor="signup-password">
                Password
              </label>
              {form.password && (
                <span style={{ fontSize: 'var(--text-xs)', color: strength.color }}>
                  {strength.label}
                </span>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <input
                id="signup-password"
                className={`field-input${errors.password ? ' field-input--error' : ''}`}
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
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
            {/* Strength bar */}
            {form.password && (
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  marginTop: '6px',
                }}
                aria-label={`Password strength: ${strength.label}`}
              >
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    style={{
                      flex: 1,
                      height: '3px',
                      borderRadius: '9999px',
                      background: n <= strength.level ? strength.color : 'var(--border)',
                      transition: 'background 200ms ease',
                    }}
                  />
                ))}
              </div>
            )}
            {errors.password && (
              <p className="field-error" role="alert">
                {errors.password}
              </p>
            )}
          </div>

          <Input
            id="signup-confirm-password"
            label="Confirm password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="Repeat password"
            value={form.confirmPassword}
            onChange={handleChange}
            error={errors.confirmPassword}
          />

          <Button
            type="submit"
            variant="primary"
            size="lg"
            fullWidth
            loading={loading}
            id="btn-signup"
          >
            Create Account
          </Button>
        </form>

        <p className="auth-link-row">
          Already have an account?{' '}
          <Link to="/login" id="link-login">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
