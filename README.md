# Домик в деревне

Статический сайт-витрина для аренды домика в деревне Ястребки 50.

Сайт не принимает бронирования и оплату. Все договоренности ведутся через Авито:
https://www.avito.ru/zvenigorod/doma_dachi_kottedzhi/1-k._dom_30_m_3276411488

## Как открыть локально

Откройте `index.html` в браузере.

## Как выложить на VPS

Скопируйте файлы проекта на сервер в папку, которую отдает Nginx, например:

```bash
/var/www/domik
```

Минимальный Nginx-конфиг:

```nginx
server {
  server_name example.ru www.example.ru;
  root /var/www/domik;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

Для HTTPS можно подключить Certbot:

```bash
sudo certbot --nginx -d example.ru -d www.example.ru
```

## Что заменить дальше

- Плейсхолдеры галереи на реальные фото кухни, спальни, бани и санузла.
- Тексты в блоках правил и удобств после уточнения деталей.
