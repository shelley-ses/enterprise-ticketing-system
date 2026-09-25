import JSEncrypt from 'jsencrypt';
import axiosInstance from '@/api/axiosInstance';

/**
 * Fetches the public key and key ID from the server
 */
export async function fetchEncryptionKey() {
  const response = await axiosInstance.get('/encryption-key');
  return response.data;
}

/**
 * Encrypts a string payload using the provided public RSA key
 */
export function encryptPayload(payload, publicKey) {
  const encryptor = new JSEncrypt();
  encryptor.setPublicKey(publicKey);
  const encrypted = encryptor.encrypt(payload);
  
  if (!encrypted) {
    throw new Error('Encryption failed');
  }
  
  return encrypted;
}
