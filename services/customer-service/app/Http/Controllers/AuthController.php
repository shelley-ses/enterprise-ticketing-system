<?php

namespace App\Http\Controllers;

use App\Models\Client;
use App\Models\Employee;
use Illuminate\Http\Request;
use App\Services\AuthService;
use Illuminate\Support\Str;
use App\Models\RefreshToken;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    protected $authService;

    public function __construct(AuthService $authService)
    {
        $this->authService = $authService;
    }

    public function login(Request $request)
    {
        Log::info('AuthController.login:entered');

        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
            'mode' => 'nullable|in:customer,employee',
        ]);

        Log::info('AuthController.login:after_validation');

        $result = $this->authService->login(
            $request->email,
            $request->password,
            $request->input('mode', 'customer')
        );

        // Return 401 on failed authentication
        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
                'user' => null,
                'token' => null,
                'is_first_login' => false,
                'remaining_attempts' => $result['remaining_attempts'] ?? null,
                'locked_until' => $result['locked_until'] ?? null,
            ], 401);
        }

        // Return 200 with user and token on success
        $resp = response()->json([
            'message' => $result['message'],
            'user' => $result['user'],
            'token' => $result['token'],
            'is_first_login' => $result['is_first_login'] ?? false,
        ], 200);

        // Set httpOnly refresh cookie
        if (!empty($result['refresh_token'])) {
            $minutes = 60 * 24 * 14; // 14 days
            $secure = config('app.env') !== 'local';
            $resp->withCookie(cookie('refresh_token', $result['refresh_token'], $minutes, '/', null, $secure, true, false, 'Lax'));
        }

        return $resp;
    }

    public function refresh(Request $request)
    {
        $raw = $request->cookie('refresh_token');
        if (!$raw) {
            return response()->json(['message' => 'No refresh token'], 401);
        }

        $hash = hash('sha256', $raw);
        $rt = \App\Models\RefreshToken::where('token_hash', $hash)->first();

        if (!$rt || ($rt->expires_at && $rt->expires_at->isPast())) {
            return response()->json(['message' => 'Invalid or expired refresh token'], 401);
        }

        $client = $rt->client;
        $employee = $rt->employee;
        if (!$client && !$employee) {
            return response()->json(['message' => 'Client not found'], 401);
        }

        $user = $client ?: $employee;

        // issue new access token
        $accessToken = $user->createToken('access-token')->plainTextToken;

        // rotate refresh token
        $rawNew = Str::random(80);
        $hashNew = hash('sha256', $rawNew);
        $rt->token_hash = $hashNew;
        $rt->expires_at = now()->addDays(14);
        $rt->save();

        $minutes = 60 * 24 * 14;
        $secure = config('app.env') !== 'local';

        $resp = response()->json([
            'token' => $accessToken,
            'user' => $user,
            'is_first_login' => $user instanceof Employee
                ? $user->password_change_at === null
                : optional($user->credential)->password_change_at === null,
        ], 200);
        $resp->withCookie(cookie('refresh_token', $rawNew, $minutes, '/', null, $secure, true, false, 'Lax'));
        return $resp;
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $isFirstLogin = false;

        if ($user) {
            $isFirstLogin = $user instanceof Employee
                ? $user->password_change_at === null
                : optional($user->credential)->password_change_at === null;
        }

        return response()->json([
            'user' => $user,
            'is_first_login' => $isFirstLogin,
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $result = $this->authService->requestPasswordResetOtp($request->email);

        return response()->json([
            'message' => $result['message'],
            'expires_at' => $result['expires_at'] ?? null,
        ], 200);
    }

    public function verifyForgotPasswordOtp(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
        ]);

        $result = $this->authService->verifyPasswordResetOtp($request->email, $request->otp);

        return response()->json([
            'message' => $result['message'],
            'remaining_attempts' => $result['remaining_attempts'] ?? null,
        ], $result['success'] ? 200 : 422);
    }

    public function resetForgotPassword(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'otp' => 'required|digits:6',
            'password' => [
                'required',
                'string',
                'confirmed',
                'min:12',
                'regex:/[A-Z]/',
                'regex:/[0-9]/',
                'regex:/[^A-Za-z0-9]/',
            ],
        ]);

        $result = $this->authService->resetPasswordWithOtp($request->email, $request->otp, $request->password);

        return response()->json([
            'message' => $result['message'],
        ], $result['success'] ? 200 : 422);
    }

    public function logout(Request $request)
    {
        $rawRefresh = $request->cookie('refresh_token');
        if ($rawRefresh) {
            RefreshToken::where('token_hash', hash('sha256', $rawRefresh))->delete();
        }

        $user = $request->user();

        if ($user) {
            $user->tokens()->delete();
            // remove refresh tokens
            if ($user instanceof Employee) {
                RefreshToken::where('employee_id', $user->emp_id)->delete();
            } else {
                RefreshToken::where('client_id', $user->id)->delete();
            }
        }

        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        $resp = response()->json([
            'message' => 'Logged out successfully',
        ]);

        // clear refresh cookie
        $resp->withCookie(cookie()->forget('refresh_token'));

        return $resp;
    }
}