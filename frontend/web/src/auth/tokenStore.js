const TOKEN_STORAGE_KEY = 'access_token';

let accessToken = null;

try {
  accessToken = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!accessToken) {
    accessToken = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (accessToken) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, accessToken);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
} catch {
  accessToken = null;
}

export function setToken(token) {
  accessToken = token;

  try {
    if (token) {
      sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    } else {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage failures and keep the in-memory token.
  }
}

export function getToken() {
  return accessToken;
}

export function clearToken() {
  accessToken = null;

  try {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export default { setToken, getToken, clearToken };
