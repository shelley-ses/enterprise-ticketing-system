<?php

namespace App\Auth;

use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Contracts\Auth\Authenticatable;
use Illuminate\Auth\EloquentUserProvider;
use Illuminate\Support\Facades\DB;

class PolymorphicUserProvider implements UserProvider
{
    protected $employeeProvider;
    protected $clientProvider;

    public function __construct(EloquentUserProvider $employeeProvider, EloquentUserProvider $clientProvider)
    {
        $this->employeeProvider = $employeeProvider;
        $this->clientProvider = $clientProvider;
    }

    protected function getTargetProvider()
    {
        $bearerToken = request()->bearerToken();
        if ($bearerToken) {
            $parts = explode('.', $bearerToken);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode($parts[1]), true);
                $tokenId = $payload['jti'] ?? null;
                if ($tokenId) {
                    $token = DB::table('oauth_access_tokens')->where('id', $tokenId)->first();
                    if ($token) {
                        if ($token->name === 'client') {
                            return $this->clientProvider;
                        }
                    }
                }
            }
        }
        return $this->employeeProvider;
    }

    public function retrieveById($identifier)
    {
        $bearerToken = request()->bearerToken();
        if ($bearerToken) {
            $parts = explode('.', $bearerToken);
            if (count($parts) === 3) {
                $payload = json_decode(base64_decode($parts[1]), true);
                $tokenId = $payload['jti'] ?? null;
                if ($tokenId) {
                    $token = DB::table('oauth_access_tokens')->where('id', $tokenId)->first();
                    if ($token) {
                        if ($token->name === 'client') {
                            return $this->clientProvider->retrieveById($identifier);
                        } else {
                            return $this->employeeProvider->retrieveById($identifier);
                        }
                    }
                }
            }
        }

        return $this->employeeProvider->retrieveById($identifier) 
            ?: $this->clientProvider->retrieveById($identifier);
    }

    public function retrieveByToken($identifier, $token)
    {
        return $this->getTargetProvider()->retrieveByToken($identifier, $token);
    }

    public function updateRememberToken(Authenticatable $user, $token)
    {
        $provider = $user instanceof \App\Models\Client ? $this->clientProvider : $this->employeeProvider;
        $provider->updateRememberToken($user, $token);
    }

    public function retrieveByCredentials(array $credentials)
    {
        return $this->employeeProvider->retrieveByCredentials($credentials)
            ?: $this->clientProvider->retrieveByCredentials($credentials);
    }

    public function validateCredentials(Authenticatable $user, array $credentials)
    {
        $provider = $user instanceof \App\Models\Client ? $this->clientProvider : $this->employeeProvider;
        return $provider->validateCredentials($user, $credentials);
    }
}
