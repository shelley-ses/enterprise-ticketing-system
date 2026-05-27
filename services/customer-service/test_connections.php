<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "--- Printing All Employees ---\n";
try {
    $employees = App\Models\Employee::all();
    echo "Found: " . count($employees) . " employees\n";
    foreach ($employees as $employee) {
        echo "ID: {$employee->emp_id} | Email: {$employee->email} | Name: {$employee->first_name} {$employee->last_name} | Role: {$employee->role} | Dept: {$employee->department}\n";
    }
} catch (\Exception $e) {
    echo "Error fetching employees: " . $e->getMessage() . "\n";
}

echo "\n--- Printing All Departments ---\n";
try {
    $departments = Illuminate\Support\Facades\DB::table('departments')->get();
    echo "Found: " . count($departments) . " departments\n";
    foreach ($departments as $dept) {
        echo "ID: {$dept->id} | Name: {$dept->name}\n";
    }
} catch (\Exception $e) {
    echo "Error fetching departments: " . $e->getMessage() . "\n";
}
