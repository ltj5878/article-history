import { useState } from 'react';

export default function AuthControl({ auth }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const user = auth.user;

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'register') {
        await auth.register(email, password);
      }
      await auth.login(email, password);
      setPassword('');
      setOpen(false);
    } catch (err) {
      setError(err?.message || '认证失败');
    } finally {
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="auth">
        <div className="auth__badge" title={user.email}>
          <span className="auth__email">{user.email}</span>
          <span className="auth__role">{user.role === 'admin' ? '管理员' : '读者'}</span>
        </div>
        <button type="button" className="auth__link" onClick={auth.logout}>退出</button>
      </div>
    );
  }

  return (
    <div className="auth">
      <button type="button" className="auth__trigger" onClick={() => setOpen(o => !o)}>
        登录
      </button>
      {open && (
        <form className="auth__panel" onSubmit={submit}>
          <div className="auth__tabs">
            <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => setMode('login')}>登录</button>
            <button type="button" className={mode === 'register' ? 'is-active' : ''} onClick={() => setMode('register')}>注册</button>
          </div>
          <label className="auth__field">
            <span>邮箱</span>
            <input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="auth__field">
            <span>密码</span>
            <input value={password} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={12} onChange={(e) => setPassword(e.target.value)} required />
          </label>
          {error && <div className="auth__error">{error}</div>}
          <button type="submit" className="auth__submit" disabled={busy}>
            {busy ? '处理中' : (mode === 'login' ? '登录' : '注册并登录')}
          </button>
        </form>
      )}
    </div>
  );
}
