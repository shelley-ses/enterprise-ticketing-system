import axios from 'axios';
import tokenStore from '@/auth/tokenStore';
import { refreshAccessToken } from '@/auth/refreshSession';
import { CONFIGURATION_API_URL } from '@/config/api.config';
import { fetchEncryptionKey, encryptPayload } from '@/utils/rsa';

const configClient = axios.create({
  baseURL: CONFIGURATION_API_URL || '/api/ticketing/configuration',
  withCredentials: true,
  headers: {
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

configClient.interceptors.request.use((config) => {
  const token = tokenStore.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

configClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshed = await refreshAccessToken();
      const currentToken = tokenStore.getToken();
      if (refreshed && currentToken) {
        originalRequest.headers.Authorization = `Bearer ${currentToken}`;
        return configClient(originalRequest);
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Fetches the ephemeral RSA encryption key directly from configuration-service
 * or falls back to the default gateway encryption key.
 */
async function getServiceEncryptionKey() {
  try {
    const res = await configClient.get('/encryption-key');
    if (res.data?.public_key && res.data?.key_id) {
      return res.data;
    }
  } catch {
    // Fall back to default auth/gateway key
  }
  return fetchEncryptionKey();
}

/**
 * Fetch the current email delivery configuration.
 * Returns { is_configured: boolean, data: { provider, api_key: 're_•••••••••', from_name, from_email, last_tested } | null }
 */
export async function getEmailConfiguration() {
  const response = await configClient.get('/email');
  return response.data;
}

/**
 * Save new email configuration with client-side RSA encryption for the API key.
 */
export async function saveEmailConfiguration({ apiKey, fromName, fromEmail }) {
  const { public_key, key_id } = await getServiceEncryptionKey();
  const encryptedApiKey = encryptPayload(apiKey.trim(), public_key);

  const response = await configClient.post(
    '/email',
    {
      apiKey: encryptedApiKey,
      fromName: fromName.trim(),
      fromEmail: fromEmail.trim(),
    },
    {
      headers: {
        'X-Key-Id': key_id,
      },
    }
  );
  return response.data;
}

/**
 * Update the API key for the active configuration with RSA encryption.
 */
export async function updateEmailApiKey(apiKey) {
  const { public_key, key_id } = await getServiceEncryptionKey();
  const encryptedApiKey = encryptPayload(apiKey.trim(), public_key);

  const response = await configClient.put(
    '/email/api-key',
    {
      apiKey: encryptedApiKey,
    },
    {
      headers: {
        'X-Key-Id': key_id,
      },
    }
  );
  return response.data;
}

/**
 * Remove the active email configuration.
 */
export async function removeEmailConfiguration() {
  const response = await configClient.delete('/email');
  return response.data;
}

/**
 * Dispatches a test verification email via Resend.
 */
export async function sendTestEmail({ recipientEmail, apiKey, fromName, fromEmail }) {
  const headers = {};
  const payload = {
    recipientEmail: recipientEmail.trim(),
  };

  if (apiKey) {
    const { public_key, key_id } = await getServiceEncryptionKey();
    payload.apiKey = encryptPayload(apiKey.trim(), public_key);
    payload.fromName = fromName?.trim();
    payload.fromEmail = fromEmail?.trim();
    headers['X-Key-Id'] = key_id;
  }

  const response = await configClient.post(
    '/email/test',
    payload,
    { headers }
  );
  return response.data;
}
