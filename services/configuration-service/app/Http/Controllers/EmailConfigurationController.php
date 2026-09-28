<?php

namespace App\Http\Controllers;

use App\Models\EmailConfiguration;
use App\Services\ResendService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmailConfigurationController extends Controller
{
    protected ResendService $resendService;

    public function __construct(ResendService $resendService)
    {
        $this->resendService = $resendService;
    }

    /**
     * Issues an ephemeral RSA public key for frontend payload encryption.
     * Caches the matching private key in Redis with a 15-minute TTL.
     */
    public function getEncryptionKey()
    {
        $config = [
            'digest_alg' => 'sha256',
            'private_key_bits' => 2048,
            'private_key_type' => OPENSSL_KEYTYPE_RSA,
        ];

        $res = openssl_pkey_new($config);
        openssl_pkey_export($res, $privateKey);
        $keyDetails = openssl_pkey_get_details($res);
        $publicKey = $keyDetails['key'];

        $keyId = Str::uuid()->toString();

        Cache::put("rsa_key_{$keyId}", $privateKey, now()->addMinutes(15));

        return response()->json([
            'key_id' => $keyId,
            'public_key' => $publicKey,
        ]);
    }

    /**
     * Retrieves the current email delivery configuration.
     * Guaranteed zero plaintext exposure: API key is always returned as re_•••••••••.
     */
    public function getConfiguration()
    {
        $config = EmailConfiguration::where('is_active', true)->latest()->first();

        if (!$config) {
            return response()->json([
                'is_configured' => false,
                'data' => null,
            ]);
        }

        return response()->json([
            'is_configured' => true,
            'data' => $config->toMaskedResponse(),
        ]);
    }

    /**
     * Saves or replaces the Resend email delivery configuration.
     * Validates and pings the Resend API before persisting the encrypted key.
     */
    public function saveConfiguration(Request $request)
    {
        $validated = $request->validate([
            'apiKey' => 'required|string|min:8',
            'fromName' => 'required|string|max:255',
            'fromEmail' => 'required|email|max:255',
        ], [
            'apiKey.required' => 'API Key is required and cannot be empty.',
            'fromName.required' => 'From Name is required and cannot be empty.',
            'fromEmail.required' => 'From Email is required and cannot be empty.',
            'fromEmail.email' => 'Please provide a valid sender email address.',
        ]);

        $rawApiKey = trim($validated['apiKey']);

        // Live ping verification against Resend API
        $verifyResult = $this->resendService->verifyApiKey($rawApiKey);
        if (!$verifyResult['valid']) {
            return response()->json([
                'message' => 'Resend API Key verification failed.',
                'errors' => [
                    'apiKey' => $verifyResult['error'],
                ],
            ], 422);
        }

        // Deactivate previous active configurations
        EmailConfiguration::where('is_active', true)->update(['is_active' => false]);

        // Create new active configuration (api_key is encrypted automatically via Eloquent cast)
        $config = EmailConfiguration::create([
            'provider' => 'Resend',
            'api_key' => $rawApiKey,
            'from_name' => trim($validated['fromName']),
            'from_email' => trim($validated['fromEmail']),
            'is_active' => true,
            'last_tested_at' => null,
        ]);

        return response()->json([
            'message' => 'Resend email delivery configuration saved successfully.',
            'data' => $config->toMaskedResponse(),
        ]);
    }

    /**
     * Updates only the API key for the active configuration.
     * Verifies key against Resend API before persisting.
     */
    public function updateApiKey(Request $request)
    {
        $validated = $request->validate([
            'apiKey' => 'required|string|min:8',
        ], [
            'apiKey.required' => 'API Key is required and cannot be empty.',
        ]);

        $rawApiKey = trim($validated['apiKey']);

        // Live ping verification
        $verifyResult = $this->resendService->verifyApiKey($rawApiKey);
        if (!$verifyResult['valid']) {
            return response()->json([
                'message' => 'Resend API Key verification failed.',
                'errors' => [
                    'apiKey' => $verifyResult['error'],
                ],
            ], 422);
        }

        $config = EmailConfiguration::where('is_active', true)->latest()->first();

        if (!$config) {
            return response()->json([
                'message' => 'No active email configuration found to update. Please add a configuration first.',
            ], 404);
        }

        $config->update([
            'api_key' => $rawApiKey,
        ]);

        return response()->json([
            'message' => 'Resend API Key updated and verified successfully.',
            'data' => $config->toMaskedResponse(),
        ]);
    }

    /**
     * Removes the active email delivery configuration.
     */
    public function removeConfiguration()
    {
        EmailConfiguration::where('is_active', true)->update(['is_active' => false]);

        return response()->json([
            'message' => 'Email delivery configuration has been removed successfully.',
        ]);
    }

    /**
     * Dispatches a test email via Resend to verify deliverability.
     */
    public function sendTestEmail(Request $request)
    {
        $validated = $request->validate([
            'recipientEmail' => 'required|email',
            'apiKey' => 'nullable|string',
            'fromName' => 'nullable|string',
            'fromEmail' => 'nullable|email',
        ]);

        $recipient = trim($validated['recipientEmail']);
        $config = EmailConfiguration::where('is_active', true)->latest()->first();

        $apiKey = !empty($validated['apiKey']) ? trim($validated['apiKey']) : $config?->api_key;
        $fromName = !empty($validated['fromName']) ? trim($validated['fromName']) : ($config?->from_name ?? 'SBSI Support');
        $fromEmail = !empty($validated['fromEmail']) ? trim($validated['fromEmail']) : ($config?->from_email ?? 'onboarding@resend.dev');

        if (empty($apiKey)) {
            return response()->json([
                'message' => 'No API Key available to test. Please provide a key or save a configuration first.',
            ], 422);
        }

        $result = $this->resendService->sendTestEmail($apiKey, $fromName, $fromEmail, $recipient);

        if (!$result['success']) {
            return response()->json([
                'message' => 'Failed to deliver test email via Resend.',
                'error' => $result['error'],
            ], 422);
        }

        if ($config) {
            $config->update(['last_tested_at' => now()]);
        }

        return response()->json([
            'message' => "A test verification email from \"{$fromName}\" <{$fromEmail}> was successfully delivered to {$recipient} via Resend.",
            'resend_id' => $result['id'],
            'last_tested' => now()->format('M j, h:i A'),
        ]);
    }

    /**
     * Inter-service dispatch endpoint for other microservices (e.g. ticket-service)
     * to send transactional emails via Resend using the active configuration.
     */
    public function dispatchEmail(Request $request)
    {
        $validated = $request->validate([
            'to' => 'required|email',
            'subject' => 'required|string',
            'html' => 'required|string',
        ]);

        $config = EmailConfiguration::where('is_active', true)->latest()->first();

        if (!$config) {
            return response()->json([
                'message' => 'No active email delivery configuration found.',
            ], 404);
        }

        $result = $this->resendService->sendRawEmail(
            $config->api_key,
            $config->from_name,
            $config->from_email,
            $validated['to'],
            $validated['subject'],
            $validated['html']
        );

        if (!$result['success']) {
            return response()->json([
                'message' => 'Failed to dispatch email via Resend.',
                'error' => $result['error'],
            ], 502);
        }

        return response()->json([
            'message' => 'Email dispatched successfully via Resend.',
            'id' => $result['id'],
        ]);
    }
}
