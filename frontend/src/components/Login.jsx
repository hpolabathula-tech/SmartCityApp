import React, { useState, useEffect } from 'react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState(null);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

  useEffect(() => {
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
    localStorage.setItem('darkMode', JSON.stringify(isDark));
  }, [isDark]);

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Weak', color: '#f85149', width: '25%' };
    if (score === 2) return { label: 'Fair', color: '#e3b341', width: '50%' };
    if (score === 3) return { label: 'Good', color: '#3fb950', width: '75%' };
    return { label: 'Strong', color: '#58a6ff', width: '100%' };
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');

    if (lockoutUntil && new Date() < lockoutUntil) {
      const secs = Math.ceil((lockoutUntil - new Date()) / 1000);
      setError(`Too many failed attempts. Try again in ${secs}s.`);
      return;
    }

    if (isRegister && name.trim().length < 2) {
      setError('Name must be at least 2 characters.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.'); return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/auth/register' : '/auth/login';
    const payload = isRegister
      ? { name: name.trim(), email: email.trim().toLowerCase(), password }
      : { email: email.trim().toLowerCase(), password };

    try {
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Authentication failed');

      setAttempts(0);
      setLockoutUntil(null);

      if (isRegister) {
        setIsRegister(false);
        setPassword('');
        setName('');
        setError('✓ Registration successful! Please sign in.');
      } else {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        onLoginSuccess(data.token, data.user);
      }
    } catch (err) {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        const until = new Date(new Date().getTime() + 30000);
        setLockoutUntil(until);
        setError('Too many failed attempts. Locked for 30 seconds.');
      } else {
        setError(`${err.message} (${5 - newAttempts} attempts remaining)`);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerQuickLogin = (quickEmail, quickPassword) => {
    setEmail(quickEmail);
    setPassword(quickPassword);
    setIsRegister(false);
    setError('');
    setTimeout(() => {
      document.getElementById('login-form-btn').click();
    }, 100);
  };

  const strength = getPasswordStrength(password);

  return (
    <div style={styles.container}>
      <button
        onClick={() => setIsDark(!isDark)}
        style={styles.themeToggle}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        <span className="material-symbols-outlined">{isDark ? 'light_mode' : 'dark_mode'}</span>
      </button>

      <div style={styles.card}>
        <div style={styles.header}>
          <span className="material-symbols-outlined" style={styles.logoIcon}>hub</span>
          <h2 style={styles.title}>Smart City Knowledge Portal</h2>
          <p style={styles.subtitle}>
            {isRegister ? 'Create an account to query regulations' : 'Sign in to access civic data and RAG pipelines'}
          </p>
        </div>

        {error && (
          <div style={error.includes('✓') ? styles.successBox : styles.errorBox}>
            <span className="material-symbols-outlined" style={styles.errorIcon}>
              {error.includes('✓') ? 'check_circle' : 'info'}
            </span>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleAuth} style={styles.form}>
          {isRegister && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Full Name</label>
              <div style={styles.inputContainer}>
                <span className="material-symbols-outlined" style={styles.inputIcon}>person</span>
                <input
                  type="text"
                  placeholder="John Doe"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  style={styles.input}
                />
              </div>
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email Address</label>
            <div style={styles.inputContainer}>
              <span className="material-symbols-outlined" style={styles.inputIcon}>mail</span>
              <input
                type="email"
                placeholder="your.email@smartcity.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={styles.input}
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputContainer}>
              <span className="material-symbols-outlined" style={styles.inputIcon}>lock</span>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                style={styles.input}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'var(--color-outline)' }}>
                  {showPassword ? 'visibility_off' : 'visibility'}
                </span>
              </button>
            </div>
            {isRegister && strength && (
              <div style={styles.strengthWrapper}>
                <div style={styles.strengthTrack}>
                  <div style={{ ...styles.strengthFill, width: strength.width, backgroundColor: strength.color }} />
                </div>
                <span style={{ ...styles.strengthLabel, color: strength.color }}>{strength.label}</span>
              </div>
            )}
          </div>

          <button type="submit" id="login-form-btn" disabled={loading} style={styles.submitBtn} className="active-scale">
            {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign In'}
          </button>
        </form>

        <div style={styles.toggleText}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button onClick={() => { setIsRegister(!isRegister); setError(''); }} style={styles.toggleBtn}>
            {isRegister ? 'Login here' : 'Register here'}
          </button>
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>Developer / Seed Roles</span>
        </div>

        <div style={styles.quickRoles}>
          <button
            onClick={() => triggerQuickLogin('admin@smartcity.gov', 'admin123')}
            style={{ ...styles.quickBtn, borderLeft: '4px solid var(--color-primary)' }}
            className="hover-lift active-scale"
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>admin_panel_settings</span>
            <div style={styles.quickBtnText}>
              <strong>Login as Admin</strong>
              <span>Upload and Manage Docs</span>
            </div>
          </button>

          <button
            onClick={() => triggerQuickLogin('citizen@smartcity.gov', 'citizen123')}
            style={{ ...styles.quickBtn, borderLeft: '4px solid var(--color-secondary)' }}
            className="hover-lift active-scale"
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--color-secondary)' }}>person</span>
            <div style={styles.quickBtnText}>
              <strong>Login as Citizen</strong>
              <span>Ask City & Waste Rules</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: 'var(--color-background)', padding: 'var(--spacing-md)', position: 'relative' },
  themeToggle: { position: 'fixed', top: '16px', right: '16px', background: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-md)', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--color-on-surface)', boxShadow: 'var(--shadow-md)', zIndex: 100 },
  card: { width: '100%', maxWidth: '460px', backgroundColor: 'var(--color-surface)', borderRadius: 'var(--rounded-xl)', border: '1px solid var(--color-outline-variant)', boxShadow: 'var(--shadow-lg)', padding: 'var(--spacing-lg)' },
  header: { textAlign: 'center', marginBottom: 'var(--spacing-md)' },
  logoIcon: { fontSize: '40px', color: 'var(--color-primary)', marginBottom: 'var(--spacing-xs)' },
  title: { fontSize: '22px', fontWeight: '700', color: 'var(--color-on-surface)', marginBottom: 'var(--spacing-base)' },
  subtitle: { fontSize: '14px', color: 'var(--color-on-surface-variant)', lineHeight: '1.4' },
  form: { display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: 'var(--spacing-base)' },
  label: { fontSize: '12px', fontWeight: '600', color: 'var(--color-on-surface-variant)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  inputContainer: { display: 'flex', alignItems: 'center', backgroundColor: 'var(--color-surface-container-low)', borderRadius: 'var(--rounded-md)', border: '1px solid var(--color-outline-variant)', padding: '0 var(--spacing-sm)', transition: 'border-color 0.2s' },
  inputIcon: { color: 'var(--color-on-surface-variant)', marginRight: 'var(--spacing-xs)', fontSize: '20px' },
  input: { flex: 1, border: 'none', outline: 'none', backgroundColor: 'transparent', padding: '10px 0', color: 'var(--color-on-surface)', fontSize: '14px' },
  eyeBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
  strengthWrapper: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' },
  strengthTrack: { flex: 1, height: '4px', backgroundColor: 'var(--color-outline-variant)', borderRadius: '2px', overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: '2px', transition: 'width 0.3s, background-color 0.3s' },
  strengthLabel: { fontSize: '11px', fontWeight: '600', minWidth: '40px' },
  submitBtn: { backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)', border: 'none', borderRadius: 'var(--rounded-md)', padding: '12px', fontWeight: '600', cursor: 'pointer', marginTop: 'var(--spacing-base)', boxShadow: 'var(--shadow-sm)', transition: 'opacity 0.2s' },
  toggleText: { textAlign: 'center', fontSize: '14px', color: 'var(--color-on-surface-variant)', marginTop: 'var(--spacing-md)' },
  toggleBtn: { border: 'none', background: 'none', color: 'var(--color-primary)', fontWeight: '600', cursor: 'pointer' },
  errorBox: { display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)', padding: 'var(--spacing-sm)', borderRadius: 'var(--rounded-md)', fontSize: '14px', marginBottom: 'var(--spacing-md)', border: '1px solid var(--color-outline-variant)' },
  successBox: { display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)', backgroundColor: 'var(--color-secondary-container)', color: 'var(--color-on-secondary-container)', padding: 'var(--spacing-sm)', borderRadius: 'var(--rounded-md)', fontSize: '14px', marginBottom: 'var(--spacing-md)' },
  errorIcon: { fontSize: '20px' },
  divider: { display: 'flex', alignItems: 'center', margin: 'var(--spacing-md) 0' },
  dividerText: { fontSize: '12px', fontWeight: '600', color: 'var(--color-outline)', backgroundColor: 'var(--color-surface)', padding: '0 var(--spacing-xs)', margin: '0 auto' },
  quickRoles: { display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xs)' },
  quickBtn: { display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', padding: 'var(--spacing-sm)', backgroundColor: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline-variant)', borderRadius: 'var(--rounded-md)', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' },
  quickBtnText: { display: 'flex', flexDirection: 'column', gap: '2px', color: 'var(--color-on-surface)' },
};
