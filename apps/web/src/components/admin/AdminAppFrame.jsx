import { useEffect } from 'react';

/** Admin console uses full viewport — overrides member app #root max-width: 480px. */
export function AdminAppFrame({ children }) {
  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.add('admin-full-width');
    document.body.classList.add('admin-app');
    return () => {
      root?.classList.remove('admin-full-width');
      document.body.classList.remove('admin-app');
    };
  }, []);

  return children;
}
