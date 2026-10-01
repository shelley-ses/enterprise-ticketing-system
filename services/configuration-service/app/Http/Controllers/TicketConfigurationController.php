<?php

namespace App\Http\Controllers;

use App\Models\TicketConfiguration;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TicketConfigurationController extends Controller
{
    /**
     * Default configurations baseline.
     */
    protected array $defaults = [
        'number_format' => [
            'prefix' => 'TKT',
            'includeDeptCode' => false,
            'deptCode' => '',
            'dateSegment' => 'none',
            'digitLength' => 4,
        ],
        'defaults' => [
            'status' => 'Open',
            'priority' => 'Low',
            'slaPolicy' => 'dynamic',
        ],
        'limits' => [
            'isUnlimited' => true,
            'limit' => 5,
        ],
        'transitions' => [
            'Open' => [
                'allowed' => ['In Progress (CS-owned)', 'Cancelled'],
                'type' => 'editable',
                'description' => 'Initial ticket state upon customer or internal creation.',
            ],
            'In Progress (CS-owned)' => [
                'allowed' => ['On Hold/Pending', 'Assigned', 'Resolved'],
                'type' => 'editable',
                'description' => 'Ticket being triaged or actively handled directly by Customer Service.',
            ],
            'Assigned' => [
                'allowed' => ['Reassigned', 'In Progress (Employee-owned)'],
                'type' => 'editable',
                'description' => 'Ticket dispatched to an engineer/technician and awaiting their acceptance.',
            ],
            'Reassigned' => [
                'allowed' => ['In Progress (Employee-owned)', 'Assigned'],
                'type' => 'editable',
                'description' => 'Ticket reassignment requested or approved for re-dispatch.',
            ],
            'In Progress (Employee-owned)' => [
                'allowed' => ['On Hold/Pending', 'Reassigned', 'Resolved'],
                'type' => 'editable',
                'description' => 'Service engineer has accepted the assignment and is actively working on the machine.',
            ],
            'Resolved' => [
                'allowed' => ['Closed', 'In Progress (Employee-owned)'],
                'type' => 'editable',
                'description' => 'Work is marked complete with proof of completion pending evaluation.',
            ],
            'Closed' => [
                'allowed' => ['Reopened'],
                'type' => 'editable',
                'caption' => 'Reopening is permitted only within the configured reopen window (e.g. 48h after resolution).',
                'description' => 'Final confirmed state. Can transition to Reopened within the allowed reopen window.',
            ],
            'Reopened' => [
                'allowed' => ['In Progress (CS-owned)'],
                'type' => 'fixed',
                'caption' => 'Automatic transition: Reopened tickets immediately route to Customer Service (CS-owned). This transition is system-automated and non-editable.',
                'description' => 'Ticket reopened by customer within window; routes automatically to CS.',
            ],
            'On Hold/Pending' => [
                'allowed' => [],
                'type' => 'contextual',
                'caption' => 'Contextual transition: Resumes back to whichever In Progress state it came from (CS-owned or Employee-owned). This is contextual rather than a fixed pair, so it is non-editable.',
                'description' => 'Ticket paused awaiting parts, customer feedback, or external dependency.',
            ],
            'Cancelled' => [
                'allowed' => [],
                'type' => 'terminal',
                'caption' => 'Terminal status: No further transitions permitted from Cancelled.',
                'description' => 'Ticket discarded or cancelled before assignment.',
            ],
        ],
        'windows' => [
            'reopenEnabled' => true,
            'reopenWindowDays' => 2,
            'autoCloseEnabled' => true,
            'autoCloseWindowDays' => 2,
        ],
        'file_limits' => [
            'maxFileSizeMB' => 15,
            'allowedFileTypes' => ['PDF', 'DOCX', 'DOC', 'JPG', 'JPEG', 'PNG'],
            'maxFileCount' => 5,
            'malwareScanningEnabled' => true,
        ],
        'routing' => [
            'new_ticket' => ['role_cs'],
            'new_message' => ['contextual_assigned'],
            'overdue_ticket' => ['role_cs'],
        ],
    ];

    /**
     * Get all ticket configuration sections.
     */
    public function index(): JsonResponse
    {
        $configs = TicketConfiguration::all()->pluck('value', 'key')->toArray();

        // Merge with defaults if any key is missing
        $result = [];
        foreach ($this->defaults as $key => $defaultVal) {
            $result[$key] = $configs[$key] ?? $defaultVal;
        }

        return response()->json($result);
    }

    /**
     * Get a specific configuration section.
     */
    public function show(string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);
        $value = TicketConfiguration::getByKey($normalizedKey, $this->defaults[$normalizedKey] ?? null);

        if ($value === null) {
            return response()->json(['message' => "Configuration section '{$key}' not found."], 404);
        }

        return response()->json([
            'key' => $normalizedKey,
            'value' => $value,
        ]);
    }

    /**
     * Save/update a configuration section.
     */
    public function update(Request $request, string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid configuration section '{$key}'."], 422);
        }

        $payload = $request->input('value', $request->all());

        // Validate payload according to section
        switch ($normalizedKey) {
            case 'number_format':
                $validated = $request->validate([
                    'prefix' => 'required|string|max:16',
                    'includeDeptCode' => 'sometimes|boolean',
                    'deptCode' => 'nullable|string|max:16',
                    'dateSegment' => 'required|string|in:none,YYYY,YYYYMM,YYYYMMDD',
                    'digitLength' => 'required|integer|min:3|max:8',
                ]);
                $value = [
                    'prefix' => strtoupper(trim($validated['prefix'])),
                    'includeDeptCode' => (bool) ($validated['includeDeptCode'] ?? false),
                    'deptCode' => strtoupper(trim($validated['deptCode'] ?? '')),
                    'dateSegment' => $validated['dateSegment'],
                    'digitLength' => (int) $validated['digitLength'],
                ];
                break;

            case 'defaults':
                $validated = $request->validate([
                    'status' => 'required|string|max:64',
                    'priority' => 'required|string|max:64',
                    'slaPolicy' => 'required|string|max:64',
                ]);
                $value = [
                    'status' => $validated['status'],
                    'priority' => $validated['priority'],
                    'slaPolicy' => $validated['slaPolicy'],
                ];
                break;

            case 'limits':
                $validated = $request->validate([
                    'isUnlimited' => 'required|boolean',
                    'limit' => 'nullable|integer|min:1|max:1000',
                ]);
                $value = [
                    'isUnlimited' => (bool) $validated['isUnlimited'],
                    'limit' => (int) ($validated['limit'] ?? 5),
                ];
                break;

            case 'windows':
                $validated = $request->validate([
                    'reopenEnabled' => 'required|boolean',
                    'reopenWindowDays' => 'required|integer|min:1|max:365',
                    'autoCloseEnabled' => 'required|boolean',
                    'autoCloseWindowDays' => 'required|integer|min:1|max:365',
                ]);
                $value = [
                    'reopenEnabled' => (bool) $validated['reopenEnabled'],
                    'reopenWindowDays' => (int) $validated['reopenWindowDays'],
                    'autoCloseEnabled' => (bool) $validated['autoCloseEnabled'],
                    'autoCloseWindowDays' => (int) $validated['autoCloseWindowDays'],
                ];
                break;

            case 'file_limits':
                $validated = $request->validate([
                    'maxFileSizeMB' => 'required|numeric|min:1|max:500',
                    'allowedFileTypes' => 'required|array|min:1',
                    'allowedFileTypes.*' => 'string|max:16',
                    'maxFileCount' => 'required|integer|min:1|max:50',
                    'malwareScanningEnabled' => 'required|boolean',
                ]);
                $value = [
                    'maxFileSizeMB' => (float) $validated['maxFileSizeMB'],
                    'allowedFileTypes' => array_values(array_unique(array_map('strtoupper', $validated['allowedFileTypes']))),
                    'maxFileCount' => (int) $validated['maxFileCount'],
                    'malwareScanningEnabled' => (bool) $validated['malwareScanningEnabled'],
                ];
                break;

            case 'routing':
                $validated = $request->validate([
                    'routing' => 'sometimes|array',
                    'new_ticket' => 'sometimes|array|min:1',
                    'new_message' => 'sometimes|array|min:1',
                    'overdue_ticket' => 'sometimes|array|min:1',
                ]);
                $value = $request->has('routing') ? $request->input('routing') : $request->only(['new_ticket', 'new_message', 'overdue_ticket']);
                break;

            case 'transitions':
                $request->validate([
                    'transitions' => 'sometimes|array',
                ]);
                $value = $request->has('transitions') ? $request->input('transitions') : $payload;
                break;

            default:
                $value = $payload;
                break;
        }

        $record = TicketConfiguration::setByKey($normalizedKey, $value);

        return response()->json([
            'message' => "Configuration for '{$normalizedKey}' updated successfully.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }

    /**
     * Reset a configuration section to its default values.
     */
    public function reset(string $key): JsonResponse
    {
        $normalizedKey = str_replace('-', '_', $key);

        if (!array_key_exists($normalizedKey, $this->defaults)) {
            return response()->json(['message' => "Invalid configuration section '{$key}'."], 422);
        }

        $defaultValue = $this->defaults[$normalizedKey];
        $record = TicketConfiguration::setByKey($normalizedKey, $defaultValue);

        return response()->json([
            'message' => "Configuration for '{$normalizedKey}' reset to defaults.",
            'key' => $normalizedKey,
            'value' => $record->value,
        ]);
    }
}
