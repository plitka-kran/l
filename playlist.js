/**
 * Lampa plugin: Playlist Auto-Select Fix
 * Проблема: при просмотре через торрент URL текущей серии при повторном
 * входе часто пересобирается (меняются служебные параметры), из-за чего
 * встроенное сравнение url === current в Lampa.Player.playlist() перестаёт
 * находить совпадение — плейлист не подсвечивает реально играющую серию,
 * пока не переключить её вручную.
 *
 * Решение: перехватываем Playlist.url() и Playlist.set(), сравниваем ссылки
 * "нормализованно" (без изменчивых параметров, либо по идентификатору
 * файла торрента link/hash+index), и если находим совпадение — подставляем
 * точную ссылку элемента плейлиста, чтобы штатная логика Lampa снова
 * сработала верно.
 *
 * Установка:
 * 1. Разместите этот файл там, где Lampa сможет его скачать по прямой
 *    ссылке (raw-ссылка на GitHub/Gist, свой хостинг, папка плагинов
 *    самохостед-сборки Lampa/Lampac и т.п.).
 * 2. В Lampa: Настройки -> Расширения -> Добавить -> вставьте URL файла.
 * 3. Включите плагин и перезапустите Lampa.
 */
(function () {
    'use strict';

    if (window.__lampa_playlist_autoselect_fix__) return;
    window.__lampa_playlist_autoselect_fix__ = true;

    // Параметры, которые часто меняются между запусками одного и того же
    // файла и не влияют на то, какой это файл: сессии, преролл-флаги,
    // таймкоды, случайные токены и т.п. Список можно расширять.
    var VOLATILE_PARAMS = [
        'preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_',
        'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid'
    ];

    // Параметры, которые надёжнее всего идентифицируют конкретный файл
    // внутри торрента у большинства балансеров/TorrServer-based ссылок.
    var IDENTITY_PARAMS = ['link', 'hash', 'index', 'file_index', 'fi', 'id'];

    function safeDecode(s) {
        try { return decodeURIComponent(s); } catch (e) { return s; }
    }

    function parseQuery(url) {
        var q = {};
        var qIndex = url.indexOf('?');
        if (qIndex === -1) return q;
        var qs = url.slice(qIndex + 1).split('#')[0];
        qs.split('&').forEach(function (pair) {
            if (!pair) return;
            var idx = pair.indexOf('=');
            var k = idx === -1 ? pair : pair.slice(0, idx);
            var v = idx === -1 ? '' : pair.slice(idx + 1);
            q[safeDecode(k).toLowerCase()] = safeDecode(v);
        });
        return q;
    }

    function pathOf(url) {
        var noProto = url.replace(/^https?:\/\//i, '');
        var slashIndex = noProto.indexOf('/');
        var host = slashIndex === -1 ? noProto : noProto.slice(0, slashIndex);
        var path = slashIndex === -1 ? '' : noProto.slice(slashIndex);
        path = path.split('?')[0].split('#')[0];
        return host.toLowerCase() + path;
    }

    function identityKey(url) {
        var q = parseQuery(url);
        var parts = [];
        IDENTITY_PARAMS.forEach(function (p) {
            if (q[p] !== undefined) parts.push(p + '=' + q[p]);
        });
        if (!parts.length) return null;
        return parts.join('&');
    }

    function normalizedKey(url) {
        var q = parseQuery(url);
        var keys = Object.keys(q).filter(function (k) {
            return VOLATILE_PARAMS.indexOf(k) === -1;
        }).sort();
        var qs = keys.map(function (k) { return k + '=' + q[k]; }).join('&');
        return pathOf(url) + '?' + qs;
    }

    // Ищем в текущем плейлисте элемент, который "тот же файл", что и raw url.
    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) return null;

        // 1) точное совпадение — тогда и патчить нечего
        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) return exact;

        // 2) совпадение по идентификатору файла торрента (самое надёжное)
        var rawId = identityKey(rawUrl);
        if (rawId) {
            var byId = items.filter(function (it) { return identityKey(it.url) === rawId; })[0];
            if (byId) return byId;
        }

        // 3) совпадение по нормализованной ссылке без изменчивых параметров
        var rawNorm = normalizedKey(rawUrl);
        var byNorm = items.filter(function (it) { return normalizedKey(it.url) === rawNorm; })[0];
        if (byNorm) return byNorm;

        return null;
    }

    var lastRawUrl = null;

    function patch() {
        if (!window.Lampa || !Lampa.Player || typeof Lampa.Player.playlist !== 'function') {
            return setTimeout(patch, 500);
        }

        var pl = Lampa.Player.playlist();
        if (!pl || pl.__autoselect_patched__) return;
        pl.__autoselect_patched__ = true;

        var origUrl = pl.url;
        var origSet = pl.set;

        pl.url = function (u) {
            lastRawUrl = u;
            try {
                var items = pl.get() || [];
                var match = findMatch(u, items);
                if (match) u = match.url;
            } catch (e) {
                // на всякий случай — не ломаем воспроизведение из-за ошибки в патче
            }
            return origUrl(u);
        };

        pl.set = function (p) {
            var res = origSet(p);
            try {
                if (lastRawUrl) {
                    var match = findMatch(lastRawUrl, p || []);
                    if (match) {
                        // пересчитываем current и позицию уже по правильной ссылке
                        origUrl(match.url);
                        origSet(p);
                    }
                }
            } catch (e) {}
            return res;
        };
    }

    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') patch();
        });
    }

    patch();
})();
