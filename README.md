# Учебный журнал — GitHub Pages + Supabase

## Архитектура
- GitHub Pages: постоянная ссылка и статический интерфейс.
- Supabase Database: расписание, задания и метаданные файлов.
- Supabase Storage: bucket `homework-files`, приватный, максимум 50 МБ на файл.
- Supabase Auth: вход старосты по email и паролю.

Cloudflare Worker, D1 и R2 для этой версии не нужны.

## 1. Настроить Supabase
Проект: `study-journal-files`. В Storage уже должен существовать приватный bucket `homework-files` с лимитом 50 MB.
В SQL Editor выполните весь файл `supabase/migrations/0001_init.sql`.

В Settings → API Keys скопируйте Publishable key (или legacy anon key). В файле `public/config.js` замените `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` на этот ключ. Это публичный ключ; Secret/service_role key НИКОГДА не помещайте в GitHub или браузер.

## 2. Создать учётную запись старосты
В Supabase → Authentication → Users → Add user создайте пользователя с email и паролем старосты.
Скопируйте его User UID. В SQL Editor выполните:
```sql
insert into public.admin_users(user_id) values ('ВСТАВЬТЕ-USER-UID');
```
После этого только этот пользователь сможет изменять расписание, задания и файлы. Студенты входят не будут.

## 3. GitHub Pages
В GitHub откройте Settings → Pages. В Build and deployment выберите Deploy from a branch, branch `main`, folder `/public`, затем Save.
Сайт будет доступен по адресу https://whedeshka.github.io/study-journal/ .
Если GitHub Pages не предлагает папку /public, используйте GitHub Actions workflow; тогда публикуйте содержимое папки public как artifact.

## 4. Доступ к файлам
Bucket остаётся Private. SQL-политика разрешает анонимное чтение объектов только из bucket homework-files; запись и удаление разрешены только пользователям, внесённым в admin_users. Поэтому студенты могут скачивать файлы без аккаунта, а управлять ими может староста.

## 5. Ограничение и срок хранения
Интерфейс и bucket ограничивают файл 50 MiB (52,428,800 байт). В задаче есть lesson_date и expires_at. Срок удаления планируется через 24 часа после окончания пары. Для удаления самих объектов Storage вместе с записями БД нужно включить запланированную Edge Function cleanup; до её настройки автоматическая очистка файлов не активна. Не включайте очистку только SQL-удалением строк — это оставит файлы в Storage.

## 6. Библиотека материалов
После обновления сайта один раз выполните в Supabase → SQL Editor содержимое файла `supabase/migrations/0002_materials.sql` и нажмите Run. Это создаст таблицу материалов и политики доступа. Файлы библиотеки сохраняются в существующий приватный bucket `homework-files`; читать и скачивать их могут все посетители, добавлять и удалять — только старосты.

## 7. Важно
Не публикуйте пароль старосты, database password или Supabase Secret/service_role key. В GitHub допустим только publishable/anon key.