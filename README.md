# Домик в деревне

Статический сайт-витрина для аренды домика в деревне Ястребки 50.

Сайт не принимает бронирования и оплату. Все договоренности ведутся через Авито:
https://www.avito.ru/zvenigorod/doma_dachi_kottedzhi/1-k._dom_30_m_3276411488

## Как открыть локально

Откройте `index.html` в браузере.

Для версии с живой синхронизацией календарей нужен Node.js:

```bash
cp .env.example .env
npm start
```

В `.env` нужно указать приватные iCal-ссылки Авито и Суточно. Этот файл не должен попадать в Git.

После запуска:

- сайт: `http://127.0.0.1:4173/`
- занятость для сайта: `http://127.0.0.1:4173/api/availability`
- календарь прямых броней для импорта на площадки: `http://127.0.0.1:4173/calendar.ics`

## Как выложить на VPS

Скопируйте файлы проекта на сервер, установите Node.js 20+ и создайте `.env`:

```bash
SUTOCHNO_ICAL_URL=https://sutochno.ru/calendar/ical/...
AVITO_ICAL_URL=https://www.avito.ru/calendars-export/.../.../....ics
PORT=4173
```

Запустите приложение:

```bash
npm start
```

Nginx должен проксировать домен на Node.js:

```bash
http://127.0.0.1:4173
```

Минимальный Nginx-конфиг:

```nginx
server {
  server_name example.ru www.example.ru;

  location / {
    proxy_pass http://127.0.0.1:4173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
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
- Контакты для прямого бронирования.
- Ссылку на Суточно.
- Админку для подтверждения прямых заявок и записи их в `calendar.ics`.
