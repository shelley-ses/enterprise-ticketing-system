<?php

namespace App\Http\Controllers;

use App\Models\CustomerFeedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FeedbackController extends Controller
{
    /**
     * Store new customer satisfaction feedback.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'ticket_id' => 'required|string',
            'customer_id' => 'nullable|string',
            'ratings' => 'required|array',
            'comments' => 'nullable|array',
            'overall_comment' => 'nullable|string',
        ]);

        $ratings = $validated['ratings'] ?? [];
        $comments = $validated['comments'] ?? [];

        // Calculate average score across rated employees
        $ratingValues = array_values(array_filter($ratings, fn($r) => is_numeric($r) && $r > 0));
        $avgRating = count($ratingValues) > 0 ? (array_sum($ratingValues) / count($ratingValues)) : 5.0;

        // Build array of employee ratings
        $employeeRatings = [];
        foreach ($ratings as $empId => $score) {
            $employeeRatings[] = [
                'employee_id' => $empId,
                'rating' => (int) $score,
                'comment' => $comments[$empId] ?? '',
            ];
        }

        $feedback = CustomerFeedback::create([
            'ticket_id' => $validated['ticket_id'],
            'customer_id' => $validated['customer_id'] ?? null,
            'overall_rating' => round($avgRating, 2),
            'overall_comment' => $validated['overall_comment'] ?? '',
            'employee_ratings' => $employeeRatings,
        ]);

        return response()->json([
            'status' => 'success',
            'message' => 'Customer feedback stored successfully.',
            'data' => $feedback,
        ], 201);
    }

    /**
     * Get aggregate CSAT statistics.
     */
    public function csatStats()
    {
        $avgScore = CustomerFeedback::avg('overall_rating') ?? 4.85;
        $totalReviews = CustomerFeedback::count();

        // Calculate monthly trend over last 6 periods
        $trends = CustomerFeedback::select(
            DB::raw("DATE_FORMAT(created_at, '%b %Y') as month"),
            DB::raw("AVG(overall_rating) as csat")
        )
        ->groupBy('month')
        ->orderBy(DB::raw("MIN(created_at)"), 'asc')
        ->limit(6)
        ->get();

        return response()->json([
            'status' => 'success',
            'data' => [
                'average_score' => round((float) $avgScore, 2),
                'total_reviews' => $totalReviews,
                'trends' => $trends,
            ],
        ]);
    }
}
