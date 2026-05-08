export const getToken  = () => localStorage.getItem('adminToken');
export const setToken  = (t) => localStorage.setItem('adminToken', t);
export const clearToken = () => localStorage.removeItem('adminToken');

export function authHeaders(extra = {}) {
  const t = getToken();
  return {
    'Content-Type': 'application/json',
    ...(t ? { 'Authorization': `Bearer ${t}` } : {}),
    ...extra,
  };
}

export async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error('Unauthorized');
  }
  return res;
}
