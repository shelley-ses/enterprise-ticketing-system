<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Redis;
use Illuminate\Support\Facades\Log;
use App\Models\Employee;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;

class VerifyEmployeeJwt
{
    /**
     * Handle an incoming request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle(Request $request, Closure $next)
    {
        $authHeader = $request->header('Authorization');
        if (!$authHeader || !str_starts_with($authHeader, 'Bearer ')) {
            Log::info('VerifyEmployeeJwt: Missing or invalid token format header: ' . ($authHeader ?: 'none'));
            return response()->json(['message' => 'Unauthorized: Missing or invalid token format'], 401);
        }

        $token = substr($authHeader, 7);
        $tokenHash = hash('sha256', $token);

        // Check local Redis cache for a valid session
        $cachedEmpId = Cache::get('sso_auth_cache:' . $tokenHash);

        if ($cachedEmpId) {
            $employee = Employee::find($cachedEmpId);
            if ($employee) {
                Auth::setUser($employee);
                $request->setUserResolver(function () use ($employee) {
                    return $employee;
                });
                return $next($request);
            }
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            Log::info('VerifyEmployeeJwt: Token does not have 3 parts: ' . count($parts));
            return response()->json(['message' => 'Unauthorized: Invalid token format'], 401);
        }

        list($headerB64, $payloadB64, $sigB64) = $parts;

        // Base64Url Decode helper
        $base64UrlDecode = function ($input) {
            $remainder = strlen($input) % 4;
            if ($remainder) {
                $padlen = 4 - $remainder;
                $input .= str_repeat('=', $padlen);
            }
            return base64_decode(strtr($input, '-_', '+/'));
        };

        // 1. Verify RS256 signature using the central public key
        $data = "$headerB64.$payloadB64";
        $signature = $base64UrlDecode($sigB64);
        
        $publicKeyPath = storage_path('auth-module-public.key');
        if (!file_exists($publicKeyPath)) {
            Log::error('VerifyEmployeeJwt: Public key file not found at ' . $publicKeyPath);
            return response()->json(['message' => 'Internal server error: Public key missing'], 500);
        }
        
        $publicKey = file_get_contents($publicKeyPath);
        $verified = openssl_verify($data, $signature, $publicKey, OPENSSL_ALGO_SHA256);
        
        if ($verified !== 1) {
            Log::warning('VerifyEmployeeJwt: Signature verification failed. Verification status: ' . $verified);
            return response()->json(['message' => 'Unauthorized: Invalid signature'], 401);
        }

        // 2. Decode payload & verify expiry
        $payload = json_decode($base64UrlDecode($payloadB64), true);
        if (!$payload) {
            Log::info('VerifyEmployeeJwt: Failed to decode token payload JSON');
            return response()->json(['message' => 'Unauthorized: Invalid token payload'], 401);
        }

        if (!isset($payload['exp']) || time() >= $payload['exp']) {
            Log::info('VerifyEmployeeJwt: Token expired. Expiry time: ' . ($payload['exp'] ?? 'unset') . ', Current time: ' . time());
            return response()->json(['message' => 'Unauthorized: Token expired'], 401);
        }

        // 3. Verify Redis blacklist
        $jti = $payload['jti'] ?? null;
        if ($jti) {
            try {
                // Connection 'auth' is configured with cache prefix 'laravel-cache-'
                $isBlacklisted = Redis::connection('auth')->get('jwt_blacklist:' . $jti);
                if ($isBlacklisted) {
                    Log::warning("VerifyEmployeeJwt: Token blacklisted", ['jti' => $jti]);
                    return response()->json(['message' => 'Unauthorized: Token has been revoked'], 401);
                }
            } catch (\Exception $e) {
                Log::error('VerifyEmployeeJwt: Redis connection failed', ['error' => $e->getMessage()]);
                return response()->json(['message' => 'Service Unavailable: Unable to verify revocation status'], 503);
            }
        } else {
            Log::info('VerifyEmployeeJwt: Missing token ID (jti)');
            return response()->json(['message' => 'Unauthorized: Missing token ID (jti)'], 401);
        }

        // 4. Look up or auto-provision Employee
        $email = $payload['email'] ?? null;
        if (!$email) {
            Log::info('VerifyEmployeeJwt: Missing email claim in token payload');
            return response()->json(['message' => 'Unauthorized: Missing email claim'], 401);
        }

        $employee = Employee::where('email', $email)->first();

        $payloadRole = $payload['role'] ?? '';
        $payloadDept = $payload['department'] ?? '';

        $mappedRole = 'service'; // fallback default
        $normDept = strtolower($payloadDept);
        $normRole = strtolower($payloadRole);
        if (str_contains($normDept, 'customer service') || str_contains($normDept, 'customer support') || $normDept === 'cs' ||
            str_contains($normRole, 'customer service') || str_contains($normRole, 'customer-service') || $normRole === 'cs') {
            $mappedRole = 'customer service';
        } elseif ($normRole === 'superadmin' || $normRole === 'super admin' || $normDept === 'superadmin' || $normDept === 'super admin') {
            $mappedRole = 'superadmin';
        } elseif ($normRole === 'it admin' || $normRole === 'admin' || ($normDept === 'admin' && $normRole !== 'superadmin')) {
            $mappedRole = 'admin';
        } elseif (str_contains($normDept, 'service') || str_contains($normDept, 'engineer') ||
                  str_contains($normRole, 'service') || str_contains($normRole, 'engineer') || $normRole === 'employee') {
            $mappedRole = 'service';
        } else {
            $mappedRole = $payloadRole ?: 'service';
        }

        if (!$employee) {
            // Auto-provision employee record in subsystem database
            $employee = new Employee();
            $employee->email = $email;
            $employee->first_name = $payload['first_name'] ?? '';
            $employee->last_name = $payload['last_name'] ?? '';
            $employee->role = $mappedRole;
            $employee->department = $payloadDept;
            $employee->is_active = true;
            $employee->password_hash = ''; // No local password hash needed for SSO users
            $employee->password_change_at = now(); // Skip first-login change password for SSO users
            $employee->save();
        } else {
            // Sync profile claims if they changed centrally
            $updated = false;
            if (($payload['first_name'] ?? '') !== $employee->first_name) {
                $employee->first_name = $payload['first_name'] ?? '';
                $updated = true;
            }
            if (($payload['last_name'] ?? '') !== $employee->last_name) {
                $employee->last_name = $payload['last_name'] ?? '';
                $updated = true;
            }
            if ($mappedRole !== $employee->role) {
                $employee->role = $mappedRole;
                $updated = true;
            }
            if ($payloadDept !== $employee->department) {
                $employee->department = $payloadDept;
                $updated = true;
            }
            if ($updated) {
                $employee->save();
            }
        }

        // 5. Authenticate the employee in the Laravel request context
        Auth::setUser($employee);
        $request->setUserResolver(function () use ($employee) {
            return $employee;
        });

        // Cache the verified employee ID in Redis for 2 minutes (120 seconds)
        Cache::put('sso_auth_cache:' . $tokenHash, $employee->emp_id, 120);

        return $next($request);
    }
}
