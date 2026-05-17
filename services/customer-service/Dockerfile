FROM php:8.2-fpm

WORKDIR /var/www

RUN apt-get update && apt-get install -y \
    git curl zip unzip libpng-dev libonig-dev libxml2-dev

# IMPORTANT: MySQL driver
RUN docker-php-ext-install pdo pdo_mysql

COPY . .

RUN php artisan key:generate

CMD php artisan serve --host=0.0.0.0 --port=8000