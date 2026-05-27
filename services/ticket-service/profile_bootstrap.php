<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';

$bootstrappers = [
    \Illuminate\Foundation\Bootstrap\LoadEnvironmentVariables::class,
    \Illuminate\Foundation\Bootstrap\LoadConfiguration::class,
    \Illuminate\Foundation\Bootstrap\HandleExceptions::class,
    \Illuminate\Foundation\Bootstrap\RegisterFacades::class,
    \Illuminate\Foundation\Bootstrap\RegisterProviders::class,
    \Illuminate\Foundation\Bootstrap\BootProviders::class,
];

echo "--- Profiling Laravel Bootstrappers ---\n";
foreach ($bootstrappers as $bootstrapper) {
    $start = microtime(true);
    $app->make($bootstrapper)->bootstrap($app);
    $duration = (microtime(true) - $start) * 1000;
    echo "$bootstrapper: " . round($duration, 2) . " ms\n";
}
echo "Bootstrapping complete!\n";
