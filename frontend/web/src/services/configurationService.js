import axiosInstance from '@/api/axiosInstance';
import { CONFIGURATION_API_URL } from '@/config/api.config';
import { fetchEncryptionKey, encryptPayload } from '@/utils/rsa';

/**
 * Fetches the ephemeral RSA encryption key directly from configuration-service
 * or falls back to the default gateway encryption key.
 */
async function getServiceEncryptionKey() {
  try {
    const res = await axiosInstance.get(`${CONFIGURATION_API_URL}/encryption-key`);
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
  const response = await axiosInstance.get(`${CONFIGURATION_API_URL}/email`);
  return response.data;
}

/**
 * Save new email configuration with client-side RSA encryption for the API key.
 */
export async function saveEmailConfiguration({ apiKey, fromName, fromEmail }) {
  const { public_key, key_id } = await getServiceEncryptionKey();
  const encryptedApiKey = encryptPayload(apiKey.trim(), public_key);

  const response = await axiosInstance.post(
    `${CONFIGURATION_API_URL}/email`,
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

  const response = await axiosInstance.put(
    `${CONFIGURATION_API_URL}/email/api-key`,
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
  const response = await axiosInstance.delete(`${CONFIGURATION_API_URL}/email`);
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

  const response = await axiosInstance.post(
    `${CONFIGURATION_API_URL}/email/test`,
    payload,
    { headers }
  );
  return response.data;
}
