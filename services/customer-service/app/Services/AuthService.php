<?php
    namespace App\Services;

    use App\Models\Client;
    use App\Models\ClientCredential;
    use App\Models\RefreshToken;
    use Illuminate\Support\Facades\Hash;
    use Illuminate\Support\Facades\Log;
    use Illuminate\Support\Carbon;
    use Illuminate\Support\Str;

    class AuthService {
        const MAX_FAILED_LOGIN = 5;
        const LOCK_MINUTES = 5;

        public function login($email, $password){
            $start = microtime(true);
            Log::info('AuthService.login:start', ['email' => $email]);

            $client = Client::with('credential')->where('email', $email)->first();
            Log::info('AuthService.login:after_client_lookup', ['duration_ms' => (microtime(true)-$start)*1000]);

            if (!$client) {
                return [
                    'success' => false,
                    'message' => 'Wrong username or password',
                    'user' => null,
                    'token' => null,
                ];
            }

            $credential = $client->credential;

            if (!$credential) {
                return [
                    'success' => false,
                    'message' => 'Wrong username or password',
                    'user' => null,
                    'token' => null,
                ];
            }

            $afterCredential = microtime(true);
            Log::info('AuthService.login:after_credential_check', ['duration_ms' => ($afterCredential-$start)*1000]);

            if ($credential->locked_until && $credential->locked_until->isFuture()) {
                return [
                    'success' => false,
                    'message' => 'Wrong username or password',
                    'user' => null,
                    'token' => null,
                    'locked_until' => $credential->locked_until,
                ];
            }

            if (!Hash::check($password, $credential->password_hash)) {
                $failedLoginCount = $credential->failed_login_count + 1;
                $credential->failed_login_count = $failedLoginCount;

                if ($failedLoginCount >= self::MAX_FAILED_LOGIN) {
                    $credential->locked_until = Carbon::now()->addMinutes(self::LOCK_MINUTES);
                }

                $credential->save();

                Log::info('AuthService.login:after_failed_password', ['duration_ms' => (microtime(true)-$start)*1000, 'failed_count' => $failedLoginCount]);

                return [
                    'success' => false,
                    'message' => 'Wrong username or password',
                    'user' => null,
                    'token' => null,
                    'remaining_attempts' => max(0, 5 - $failedLoginCount),
                    'locked_until' => $credential->locked_until,
                ];
            }

            $isFirstLogin = $credential->last_login_at === null;

            $credential->failed_login_count = 0;
            $credential->locked_until = null;
            $credential->last_login_at = Carbon::now();
            $credential->save();

            Log::info('AuthService.login:after_credential_save', ['duration_ms' => (microtime(true)-$start)*1000]);

            // create access token (short-lived)
            $accessToken = $client->createToken('access-token')->plainTextToken;
            Log::info('AuthService.login:after_access_token', ['duration_ms' => (microtime(true)-$start)*1000]);

            // create refresh token record (store hash)
            $rawRefresh = Str::random(80);
            $hash = hash('sha256', $rawRefresh);
            $expiresAt = Carbon::now()->addDays(14);

            RefreshToken::create([
                'client_id' => $client->id,
                'token_hash' => $hash,
                'expires_at' => $expiresAt,
            ]);

            Log::info('AuthService.login:after_refresh_token_create', ['duration_ms' => (microtime(true)-$start)*1000]);

            return [
                'success' => true,
                'message' => 'Login successful',
                'user' => $client,
                'token' => $accessToken,
                'is_first_login' => $isFirstLogin,
                'refresh_token' => $rawRefresh,
                'refresh_expires_at' => $expiresAt,
            ];
        }
    }
