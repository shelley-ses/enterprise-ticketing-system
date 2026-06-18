FROM php:8.2-fpm

WORKDIR /var/www

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev libzip-dev

RUN docker-php-ext-install pdo pdo_mysql zip pcntl

RUN pecl install redis && docker-php-ext-enable redis

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY composer.json ./

RUN composer install --no-interaction --prefer-dist --optimize-autoloader --no-scripts

COPY . .

RUN mkdir -p bootstrap/cache storage && composer install --no-scripts --optimize-autoloader

CMD sh -lc "if [ ! -f .env ] && [ -f .env.example ]; then cp .env.example .env; fi && if grep -q '^APP_KEY=$' .env; then php artisan key:generate --force; fi && php artisan serve --host=0.0.0.0 --port=8000"
