/*!
 * Watch Progress Cache — плагин для Lampa
 * ---------------------------------------
 * Что делает:
 *  - Запоминает для каждого фильма/сериала (по id из TMDB) последний
 *    просмотренный сезон, серию и позицию воспроизведения.
 *  - Хранит это в localStorage через Lampa.Storage (штатный механизм
 *    хранения настроек Lampa — он и так пишет в localStorage, но с этим
 *    плагином данные пишутся с привязкой именно к serial/episode).
 *  - При повторном открытии карточки сериала — подставляет сохранённые
 *    значения, чтобы плейлист/список серий "помнил", что вы смотрели.
 *
 * Установка:
 *  Настройки Lampa -> Расширения -> Добавить плагин -> указать URL,
 *  по которому лежит этот файл (например, залитый на GitHub Pages /
 *  gist raw / свой веб-сервер). Локально с телевизора файл не
 *  подключить — нужен именно http(s) адрес.
 *
 * ВАЖНО: названия полей у событий 'player' и 'full' у Lampa иногда
 * отличаются между версиями сборки (обычная Lampa / Lampac / форки).
 * Если после установки данные не начнут сохраняться — откройте
 * консоль Lampa (в боковом меню, самый низ) и посмотрите, что реально
 * прилетает в console.log ниже — вероятно, потребуется поправить пути
 * к полям (e.object.season / e.object.episode и т.п.) под вашу сборку.
 */
(function () {
    'use strict';

    // Не грузим плагин повторно, если он уже был подключен
    if (window.watch_progress_cache_installed) return;
    window.watch_progress_cache_installed = true;

    var STORAGE_KEY = 'watch_progress_cache';

    // ---------- Работа с "базой" в localStorage ----------

    function getDB() {
        // Lampa.Storage.get сам десериализует JSON и падает обратно
        // в localStorage — это и есть штатное кэширование Lampa
        return Lampa.Storage.get(STORAGE_KEY, {});
    }

    function saveDB(db) {
        Lampa.Storage.set(STORAGE_KEY, db);
    }

    function saveProgress(id, data) {
        if (!id) return;
        var db = getDB();

        db[id] = Object.assign({}, db[id], data, {
            updated: Date.now()
        });

        saveDB(db);
        console.log('[watch_progress_cache] saved', id, db[id]);
    }

    function getProgress(id) {
        if (!id) return null;
        var db = getDB();
        return db[id] || null;
    }

    // ---------- Извлечение id текущего тайтла ----------

    function extractId(data) {
        // Разные места Lampa кладут информацию по-разному, поэтому
        // проверяем несколько возможных вариантов
        if (!data) return null;
        return data.id || (data.movie && data.movie.id) || (data.card && data.card.id) || null;
    }

    // ---------- Слушаем плеер: тут узнаём сезон/серию/время ----------

    Lampa.Listener.follow('player', function (e) {
        try {
            // e.type обычно: 'start' | 'timeupdate' | 'destroy' и т.д.
            // e.data / e.object — тут лежат метаданные о том, что играет
            var payload = e.object || e.data || {};
            var movieId = extractId(payload) || extractId(e);

            if (!movieId) return;

            var progress = {};

            if (payload.season !== undefined) progress.season = payload.season;
            if (payload.episode !== undefined) progress.episode = payload.episode;
            if (payload.time !== undefined) progress.time = payload.time;
            if (payload.duration !== undefined) progress.duration = payload.duration;

            // Сохраняем только если реально что-то новое узнали
            if (Object.keys(progress).length) {
                saveProgress(movieId, progress);
            }
        } catch (err) {
            console.error('[watch_progress_cache] player listener error', err);
        }
    });

    // ---------- Слушаем открытие карточки сериала ----------

    Lampa.Listener.follow('full', function (e) {
        try {
            // 'complite' / 'complete' срабатывает, когда карточка
            // полностью отрисована и данные о фильме доступны
            if (e.type !== 'complite' && e.type !== 'complete') return;

            var data = e.data || e.object || {};
            var movieId = extractId(data) || extractId(data.movie);

            if (!movieId) return;

            var saved = getProgress(movieId);
            if (!saved) return;

            console.log('[watch_progress_cache] restoring for', movieId, saved);

            // Показываем ненавязчивое уведомление с тем, что нашли сохранённые данные
            if (saved.season !== undefined && saved.episode !== undefined) {
                Lampa.Noty.show(
                    'Продолжить просмотр: сезон ' + saved.season + ', серия ' + saved.episode
                );
            }

            // Если в вашей сборке Lampa есть метод для программного
            // выбора серии/продолжения — вызывайте его здесь, например:
            // Lampa.Activity.active().activity.render().trigger('continue', saved);
            //
            // Точное API для "перейти к серии X сезона Y" зависит от
            // версии компонента Episodes — под это стоит подставить
            // конкретный вызов после проверки в консоли.
        } catch (err) {
            console.error('[watch_progress_cache] full listener error', err);
        }
    });

    console.log('[watch_progress_cache] plugin loaded');
})();
