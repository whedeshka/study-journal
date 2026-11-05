-- Разрешить добавлять материалы только ссылкой, только файлом или обоими способами.
alter table public.materials
 alter column file_name drop not null,
 alter column mime_type drop not null,
 alter column storage_path drop not null;
alter table public.materials
 add column if not exists external_url text;
