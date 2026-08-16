import { useEffect, useId, useRef, useState } from 'react';

export default function AuthControl({ auth }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [providers, setProviders] = useState(null);
  const ref = useRef(null);
  const panelId = useId();

  const user = auth.user;
  const getOAuthProviders = auth.getOAuthProviders;

  useEffect(() => {
    if (!open) return;
    const onDoc = event => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const onKey = event => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || providers) return;
    let active = true;
    getOAuthProviders()
      .then(result => {
        if (active) setProviders(result);
      })
      .catch(err => {
        if (active) {
          setProviders([]);
          setError(err?.message || '无法读取第三方登录配置');
        }
      });
    return () => {
      active = false;
    };
  }, [getOAuthProviders, open, providers]);

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

  const startOAuth = (provider) => {
    setError('');
    setBusy(true);
    try {
      auth.startOAuth(provider);
    } catch (err) {
      setError(err?.message || '无法发起第三方登录');
      setBusy(false);
    }
  };

  if (user) {
    return (
      <div className="auth">
        <div className="auth__badge" title={user.displayName || user.email || '已登录'}>
          <span className="auth__email">{user.displayName || user.email || '已登录用户'}</span>
          {user.provider && <span className={`auth__provider auth__provider--${user.provider}`}>{user.provider === 'qq' ? 'QQ' : '微信'}</span>}
          <span className="auth__role">{user.role === 'admin' ? '管理员' : '读者'}</span>
        </div>
        {user.role === 'admin' && (
          <button type="button" className="auth__link" onClick={auth.openAdmin}>后台</button>
        )}
        <button type="button" className="auth__link" onClick={auth.logout}>退出</button>
      </div>
    );
  }

  return (
    <div className="auth" ref={ref}>
      <button type="button" className="auth__trigger" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(o => !o)}>
        登录
      </button>
      {open && (
        <form id={panelId} className="auth__panel" onSubmit={submit}>
          <div className="auth__tabs">
            <button type="button" className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setError(''); }}>登录</button>
            <button type="button" className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError(''); }}>注册</button>
          </div>
          <div className="auth__oauth" aria-label="第三方登录">
            {['qq', 'wechat'].map(providerId => {
              const provider = providers?.find(item => item.id === providerId);
              const label = providerId === 'qq' ? 'QQ' : '微信';
              const unavailable = !provider?.enabled;
              return (
                <button
                  key={providerId}
                  type="button"
                  className={`auth__oauth-button auth__oauth-button--${providerId}`}
                  disabled={busy || unavailable}
                  title={providers && unavailable ? `${label}登录尚未在服务端配置` : undefined}
                  onClick={() => startOAuth(providerId)}
                >
                  <span aria-hidden="true">{providerId === 'qq' ? 'Q' : '微'}</span>
                  {providers ? `${label}登录` : '正在检测…'}
                </button>
              );
            })}
          </div>
          <div className="auth__divider"><span>或使用邮箱</span></div>
          <label className="auth__field">
            <span>邮箱</span>
            <input value={email} type="email" autoComplete="email" onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label className="auth__field">
            <span>密码</span>
            <input value={password} type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'register' ? 12 : 1} onChange={(e) => setPassword(e.target.value)} required />
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
