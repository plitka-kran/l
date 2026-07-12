/**
 * Lampa plugin: Playlist Auto-Select Fix (DEBUG BUILD)
 *
 * Та же логика, что и в обычной версии, плюс:
 *  - подробный console.log() с префиксом [PL-FIX]
 *  - визуальный оверлей поверх плеера с последними событиями,
 *    чтобы можно было сфотографировать экран ТВ и прислать скриншот.
 *
 * Установка:
 * 1. Разместите файл там, откуда Lampa сможет скачать его по прямой
 *    ссылке (raw-ссылка GitHub/Gist, свой хостинг, папка плагинов
 *    самохостед-сборки Lampa/Lampac и т.п.).
 * 2. В Lampa: Настройки -> Расширения -> Добавить -> вставьте URL файла.
 * 3. Включите плагин, перезапустите Lampa.
 * 4. Запустите сериал через торрент, дождитесь начала воспроизведения,
 *    откройте плейлист (кнопка со списком серий в плеере) — в левом
 *    верхнем углу экрана появится чёрный блок с логами. Сфотографируйте
 *    его вместе с плейлистом справа.
 *
 * Чтобы вернуть обычный (не debug) режим — просто отключите/удалите
 * этот плагин и используйте версию без логирования.
 */
(function () {
    'use strict';

    if (window.__lampa_playlist_autoselect_fix_debug__) return;
    window.__lampa_playlist_autoselect_fix_debug__ = true;

    var VOLATILE_PARAMS = [
        'preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_',
        'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid'
    ];

    var IDENTITY_PARAMS = ['link', 'hash', 'index', 'file_index', 'fi', 'id'];

    // ---------- ЛОГИРОВАНИЕ / ОВЕРЛЕЙ ----------

    var LOG_PREFIX = '[PL-FIX]';
    var logLines = [];
    var MAX_LINES = 16;
    var overlayEl = null;

    function ensureOverlay() {
        if (overlayEl && document.body.contains(overlayEl)) return overlayEl;
        overlayEl = document.createElement('div');
        overlayEl.id = 'pl-fix-debug-overlay';
        overlayEl.style.cssText = [
            'position:fixed',
            'top:8px',
            'left:8px',
            'max-width:46vw',
            'max-height:80vh',
            'overflow:hidden',
            'background:rgba(0,0,0,0.82)',
            'color:#00ff7f',
            'font-family:monospace',
            'font-size:14px',
            'line-height:1.35',
            'padding:10px 12px',
            'border:1px solid #00ff7f',
            'border-radius:6px',
            'z-index:2147483647',
            'white-space:pre-wrap',
            'word-break:break-all',
            'pointer-events:none'
        ].join(';');
        overlayEl.textContent = LOG_PREFIX + ' ожидание событий плейлиста...';
        document.body.appendChild(overlayEl);
        return overlayEl;
    }

    function render() {
        var el = ensureOverlay();
        el.textContent = logLines.join('\n');
    }

    function log() {
        var args = Array.prototype.slice.call(arguments);
        var line = args.map(function (a) {
            if (typeof a === 'object') {
                try { return JSON.stringify(a); } catch (e) { return String(a); }
            }
            return String(a);
        }).join(' ');

        var ts = new Date().toISOString().slice(11, 19);
        var full = '[' + ts + '] ' + line;

        console.log(LOG_PREFIX, full);
        logLines.push(full);
        if (logLines.length > MAX_LINES) logLines.shift();
        render();
    }

    // ---------- ЛОГИКА СОПОСТАВЛЕНИЯ ССЫЛОК ----------

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

    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) {
            log('findMatch: нет rawUrl или пустой плейлист', 'items=' + (items ? items.length : 0));
            return null;
        }

        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) {
            log('MATCH (exact) ->', exact.title || exact.url);
            return exact;
        }

        var rawId = identityKey(rawUrl);
        log('raw identityKey =', rawId);
        if (rawId) {
            var byId = items.filter(function (it) { return identityKey(it.url) === rawId; })[0];
            if (byId) {
                log('MATCH (by identity) ->', byId.title || byId.url);
                return byId;
            }
        }

        var rawNorm = normalizedKey(rawUrl);
        log('raw normalizedKey =', rawNorm);
        var byNorm = items.filter(function (it) { return normalizedKey(it.url) === rawNorm; })[0];
        if (byNorm) {
            log('MATCH (by normalized) ->', byNorm.title || byNorm.url);
            return byNorm;
        }

        log('NO MATCH FOUND. Playlist keys:');
        items.forEach(function (it, i) {
            log('  #' + i, (it.title || ''), '| id=' + identityKey(it.url), '| norm=' + normalizedKey(it.url));
        });

        return null;
    }

    // ---------- ПАТЧ LAMPA ----------

    var lastRawUrl = null;

    function patch() {
        if (!window.Lampa || !Lampa.Player || typeof Lampa.Player.playlist !== 'function') {
            return setTimeout(patch, 500);
        }

        var pl = Lampa.Player.playlist();
        if (!pl || pl.__autoselect_patched_debug__) return;
        pl.__autoselect_patched_debug__ = true;

        log('Плагин подключён, жду вызовы Playlist.url()/set()...');

        var origUrl = pl.url;
        var origSet = pl.set;

        pl.url = function (u) {
            lastRawUrl = u;
            log('Playlist.url() вызван с:', u);
            try {
                var items = pl.get() || [];
                var match = findMatch(u, items);
                if (match) {
                    log('-> подставляю точный url элемента плейлиста');
                    u = match.url;
                } else {
                    log('-> совпадение не найдено, использую url как есть');
                }
            } catch (e) {
                log('ОШИБКА в url():', e && e.message);
            }
            return origUrl(u);
        };

        pl.set = function (p) {
            log('Playlist.set() вызван, элементов:', (p || []).length);
            var res = origSet(p);
            try {
                if (lastRawUrl) {
                    var match = findMatch(lastRawUrl, p || []);
                    if (match) {
                        log('set(): пересчитываю position по найденному совпадению');
                        origUrl(match.url);
                        origSet(p);
                    } else {
                        log('set(): совпадение для lastRawUrl не найдено');
                    }
                }
            } catch (e) {
                log('ОШИБКА в set():', e && e.message);
            }
            log('Текущая position после set():', pl.position ? pl.position() : '?');
            return res;
        };
    }

    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') patch();
        });
    }

    patch();

    // на случай, если оверлей не успел смонтироваться при старте
    document.addEventListener('DOMContentLoaded', ensureOverlay);
    setTimeout(ensureOverlay, 1000);
})();
