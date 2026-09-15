<?php

namespace App\Repositories;

interface SLARepositoryInterface
{
    public function all(array $filters = []);
    public function find(int $id);
    public function create(array $data);
    public function update(int $id, array $data);
    public function delete(int $id);
    public function findMatchingRule(int $departmentId, ?int $categoryId, string $priority);
}
