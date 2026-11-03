# Учебный журнал — Cloudflare Workers + D1 + R2

Приложение использует D1 для расписания и домашних заданий, а R2 — для файлов. Это позволяет принимать вложения размером **до 30 МБ на файл** без ограничения D1 в 2 МБ на строку.

## 1. Создать D1
В Cloudflare Dashboard откройте **Storage & databases → D1 SQL Database → Create database**. Имя: `study-journal-db`. Скопируйте Database ID и замените `REPLACE_WITH_D1_DATABASE_ID` в `wrangler.jsonc`. Откройте D1 → Console и выполните весь SQL из `migrations/0001_init.sql`.

## 2. Создать R2 bucket
В Cloudflare Dashboard откройте **Storage & databases → R2 → Overview** и создайте bucket с именем `study-journal-files`. Имя должно совпадать с `bucket_name` в `wrangler.jsonc`. При первом подключении R2 Cloudflare может попросить пройти checkout и добавить платёжный метод/подписку. У R2 есть бесплатная месячная квота: 10 GB-month хранения, 1 млн операций Class A и 10 млн Class B; исходящий трафик бесплатный. Если выйти за бесплатные квоты, возможна оплата. Проверяйте актуальные условия в официальном прайсинге: https://developers.cloudflare.com/r2/pricing/

## 3. Пароль старосты
Установите Wrangler локально и выполните из папки проекта:
```bash
npm install
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put SESSION_SECRET
```
Для `ADMIN_PASSWORD` введите длинный пароль старосты. Для `SESSION_SECRET` введите отдельную длинную случайную строку. Не помещайте эти значения в GitHub. Для локального теста скопируйте `.dev.vars.example` в `.dev.vars` и заполните значения.

## 4. Публикация через Cloudflare
Для Git-интеграции Worker: Build command `npm run build`, Deploy command `npx wrangler deploy`, Root directory `/`. Убедитесь, что `wrangler.jsonc` содержит правильный D1 Database ID, D1 уже создана и R2 bucket создан. Worker должен иметь bindings `DB` и `FILES`.

## 5. Что уже внесено
- Расписание с фотографии на 2 недели, понедельник–суббота.
- Панель старосты с паролем, управление расписанием и заданиями.
- Вложения до 30 МБ на файл хранятся в R2; в D1 хранятся только метаданные.
- При удалении задания его файлы удаляются из R2.

## 6. Тарифы и ограничения
D1 и Workers имеют бесплатные квоты, но не являются безлимитными. R2 предоставляет включённые бесплатные месячные квоты, однако для активации R2 Cloudflare может потребовать checkout/платёжный метод. Превышение бесплатных квот может привести к оплате. Сверяйте лимиты перед использованием: https://developers.cloudflare.com/r2/pricing/ и https://developers.cloudflare.com/d1/platform/limits/
