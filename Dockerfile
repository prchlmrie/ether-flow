FROM php:8.2-apache

WORKDIR /var/www/html

COPY index.php detect.php app.js style.css ./

COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
