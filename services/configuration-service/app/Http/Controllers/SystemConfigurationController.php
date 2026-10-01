<?php

namespace App\Http\Controllers;

use App\Models\SystemConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class SystemConfigurationController extends Controller
{
    /**
     * Baseline default system configurations.
     */
    protected array $defaults = [
        'company_info' => [
            'address' => 'SBSI Building, 28 East Capitol Drive, Kapitolyo, Pasig City, Metro Manila, Philippines 1603',
            'contactNumber' => '+63 2 8635 9999',
            'contactEmail' => 'support@sbsi.com.ph',
            'socialLinks' => [
                ['id' => 'soc-1', 'platform' => 'LinkedIn', 'url' => 'https://www.linkedin.com/company/scientific-biotech-specialties-inc'],
                ['id' => 'soc-2', 'platform' => 'Facebook', 'url' => 'https://www.facebook.com/ScientificBiotechSpecialties'],
                ['id' => 'soc-3', 'platform' => 'Twitter / X', 'url' => 'https://x.com/sbsi_ph'],
            ],
        ],
        'system_status' => [
            'status' => 'Operational',
        ],
        'log_level' => [
            'level' => 'Info',
        ],
    ];

    /**
     * Get all system configuration sections.
     */
    public function index(): JsonResponse
    {
        $configs = SystemConfiguration::all()->pluck('value', 'key')->toArray();

        $result = [];
        foreach ($this->defaults as $key => $defaultVal) {
            $result[$key] = $configs[$key] ?? $defaultVal;
        }

        return response()->json($result);
    }

    /**
     * Get a specific system configuration section.
     */
    public function show(string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);
        $value = SystemConfiguration::getByKey($normalizedKey, $this->defaults[$normalizedKey] ?? null);

        if ($value === null) {
            return response()->json(['message' => "System configuration section '{$key}' not found."], 404);
        }

        return response()->json([
            'key' => $normalizedKey,
            'value' => $value,
        ]);
    }

    /**
     * Save/update a system configuration section.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid system configuration section '{$key}'."], 422);
        }

        $payload = $request->input('value', $request->all());

        switch ($normalizedKey) {
            case 'company_info':
                $validated = $request->validate([
                    'address' => 'required|string|min:5|max:500',
                    'contactNumber' => 'required|string|max:64',
                    'contactEmail' => 'required|email|max:128',
                    'socialLinks' => 'nullable|array',
                    'socialLinks.*.id' => 'required|string|max:64',
                    'socialLinks.*.platform' => 'required|string|max:64',
                    'socialLinks.*.url' => 'required|string|max:255',
                ]);
                $value = [
                    'address' => trim($validated['address']),
                    'contactNumber' => trim($validated['contactNumber']),
                    'contactEmail' => trim($validated['contactEmail']),
                    'socialLinks' => $validated['socialLinks'] ?? [],
                ];
                break;

            case 'system_status':
                $validated = $request->validate([
                    'status' => 'required|string|in:Operational,Under Maintenance',
                ]);
                $value = [
                    'status' => $validated['status'],
                ];
                break;

            case 'log_level':
                $validated = $request->validate([
                    'level' => 'required|string|in:Error,Warning,Info,Debug',
                ]);
                $value = [
                    'level' => $validated['level'],
                ];
                break;

            default:
                $value = $payload;
                break;
        }

        $record = SystemConfiguration::setByKey($normalizedKey, $value);

        return response()->json([
            'message' => "System configuration for '{$normalizedKey}' updated successfully.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }

    /**
     * Reset a system configuration section to baseline defaults.
     */
    public function reset(string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid system configuration section '{$key}'."], 422);
        }

        $defaultValue = $this->defaults[$normalizedKey];
        $record = SystemConfiguration::setByKey($normalizedKey, $defaultValue);

        return response()->json([
            'message' => "System configuration for '{$normalizedKey}' reset to defaults.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }
}
