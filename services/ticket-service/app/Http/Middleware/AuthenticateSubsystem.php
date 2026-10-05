<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\Employee;

class AuthenticateSubsystem
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
        // 1. Try to authenticate as Employee using central JWT

        $authHeader = $request->header('Authorization');
        if ($authHeader && str_starts_with($authHeader, 'Bearer ')) {
            $token = substr($authHeader, 7);
            $parts = explode('.', $token);
            if (count($parts) === 3 || (app()->environment('local') && $token === 'frontend-dev-token')) {
                try {
                    $verify = new VerifyEmployeeJwt();
                    $result = null;
                    
                    // Call VerifyEmployeeJwt handle method.
                    // If signature and blacklist checks pass, it will set Auth::user() and call the closure.
                    $response = $verify->handle($request, function ($req) use (&$result) {
                        $result = true;
                        return null;
                    });
                    
                    if ($result === true && ($request->user() instanceof Employee || Auth::user() instanceof Employee)) {
                        return $next($request);
                    }
                } catch (\Throwable $e) {
                    // Ignore exception and fall through to local auth:api guard
                }
            }
        }

        // 2. Fallback to local customer authentication via Passport (auth:api)
        return app(\Illuminate\Auth\Middleware\Authenticate::class)->handle($request, $next, 'api');

    }
}
