/**
 * Lampa plugin: Playlist Auto-Select Fix v3 (DEBUG BUILD)
 *
 * Исправления по сравнению с предыдущими версиями:
 *  1) Раньше плагин обращался к Lampa.Player.playlist() как к геттеру —
 *     в реальности это сеттер с другим назначением, и патч никогда не
 *     применялся. Теперь работаем напрямую с Lampa.PlayerPlaylist.
 *  2) Добавлен перехват события 'create' у Lampa.Player: до начала
 *     воспроизведения проверяем, не подменит ли плеер data.url на ссылку
 *     конкретного качества (Storage.field('video_quality_default')) —
 *     если да, синхронно чиним соответствующий элемент data.playlist,
 *     чтобы его url совпадал с тем, что реально будет играть.
 *  3) Плюс запасной "нечёткий" матчинг на PlayerPlaylist.url()/set(),
 *     как раньше — на случай другой причины рассинхронизации.
 *
 * Установка:
 * 1. Разместите файл по прямой ссылке (raw GitHub/Gist, свой хостинг,
 *    папка плагинов Lampa/Lampac).
 * 2. Lampa: Настройки -> Расширения -> Добавить -> вставьте URL файла.
 * 3. Отключите старые версии плагина (v1/v2), чтобы не мешали.
 * 4. Запустите серию, откройте плейлист, сфотографируйте экран вместе
 *    с чёрным блоком логов в левом верхнем углу.
 */
(function () {
    'use strict';

    if (window.__lampa_playlist_autoselect_fix_v3__) return;
    window.__lampa_playlist_autoselect_fix_v3__ = true;

    var VOLATILE_PARAMS = [
        'preload', 'play', 'session', 'sid', 't', 'time', 'ts', '_',
        'token', 'rnd', 'r', 'cache', 'stream_id', 'streamid'
    ];
    var IDENTITY_PARAMS = ['link', 'hash', 'index', 'file_index', 'fi', 'id'];

    // ---------- ЛОГИРОВАНИЕ / ОВЕРЛЕЙ ----------

    var LOG_PREFIX = '[PL-FIX v3]';
    var logLines = [];
    var MAX_LINES = 20;
    var overlayEl = null;

    function ensureOverlay() {
        if (overlayEl && document.body && document.body.contains(overlayEl)) return overlayEl;
        if (!document.body) return null;
        overlayEl = document.createElement('div');
        overlayEl.id = 'pl-fix-debug-overlay-v3';
        overlayEl.style.cssText = [
            'position:fixed', 'top:8px', 'left:8px',
            'max-width:46vw', 'max-height:82vh', 'overflow:hidden',
            'background:rgba(0,0,0,0.85)', 'color:#00ff7f',
            'font-family:monospace', 'font-size:13px', 'line-height:1.3',
            'padding:10px 12px', 'border:1px solid #00ff7f', 'border-radius:6px',
            'z-index:2147483647', 'white-space:pre-wrap', 'word-break:break-all',
            'pointer-events:none'
        ].join(';');
        overlayEl.textContent = LOG_PREFIX + ' ожидание событий...';
        document.body.appendChild(overlayEl);
        return overlayEl;
    }

    function render() {
        var el = ensureOverlay();
        if (el) el.textContent = logLines.join('\n');
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

    // ---------- УТИЛИТЫ СРАВНЕНИЯ ССЫЛОК (запасной вариант) ----------

    function safeDecode(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }

    function parseQuery(url) {
        var q = {};
        var qIndex = (url || '').indexOf('?');
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
        var noProto = (url || '').replace(/^https?:\/\//i, '');
        var slashIndex = noProto.indexOf('/');
        var host = slashIndex === -1 ? noProto : noProto.slice(0, slashIndex);
        var path = slashIndex === -1 ? '' : noProto.slice(slashIndex);
        path = path.split('?')[0].split('#')[0];
        return host.toLowerCase() + path;
    }

    function identityKey(url) {
        var q = parseQuery(url);
        var parts = [];
        IDENTITY_PARAMS.forEach(function (p) { if (q[p] !== undefined) parts.push(p + '=' + q[p]); });
        return parts.length ? parts.join('&') : null;
    }

    function normalizedKey(url) {
        var q = parseQuery(url);
        var keys = Object.keys(q).filter(function (k) { return VOLATILE_PARAMS.indexOf(k) === -1; }).sort();
        return pathOf(url) + '?' + keys.map(function (k) { return k + '=' + q[k]; }).join('&');
    }

    function findMatch(rawUrl, items) {
        if (!rawUrl || !items || !items.length) return null;
        var exact = items.filter(function (it) { return it.url === rawUrl; })[0];
        if (exact) return exact;
        var rawId = identityKey(rawUrl);
        if (rawId) {
            var byId = items.filter(function (it) { return identityKey(it.url) === rawId; })[0];
            if (byId) return byId;
        }
        var rawNorm = normalizedKey(rawUrl);
        var byNorm = items.filter(function (it) { return normalizedKey(it.url) === rawNorm; })[0];
        if (byNorm) return byNorm;
        return null;
    }

    // ---------- ФИКС №1: перехват выбора качества до старта плеера ----------

    function reimplementGetUrlQuality(quality) {
        // Повторяем логику оригинальной getUrlQuality(quality, false) —
        // возвращаем url только если качество совпадает с настройкой
        // video_quality_default, без фолбэка на "лучшее качество".
        if (!quality || typeof quality !== 'object') return '';
        var def = null;
        try { def = Lampa.Storage.field('video_quality_default'); } catch (e) {}
        for (var q in quality) {
            var qa = quality[q];
            var qu = (typeof qa === 'object' && qa) ? qa.url : (typeof qa === 'string' ? qa : '');
            if (parseInt(q) === parseInt(def) && qu) return qu;
        }
        return '';
    }

    function patchPlayerCreate() {
        if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener || typeof Lampa.Player.listener.follow !== 'function') {
            return false;
        }

        Lampa.Player.listener.follow('create', function (e) {
            try {
                var data = e && e.data;
                if (!data) return;

                var originalUrl = data.url;
                log('PLAY create: url =', originalUrl);

                var qualityKeysCount = 0;
                if (data.quality && typeof data.quality === 'object') {
                    qualityKeysCount = Object.keys(data.quality).length;
                    log('data.quality keys:', qualityKeysCount, Object.keys(data.quality));
                }

                var finalUrl = originalUrl;
                if (data.quality && qualityKeysCount > 1) {
                    var picked = reimplementGetUrlQuality(data.quality);
                    if (picked) finalUrl = picked;
                }

                if (finalUrl !== originalUrl) {
                    log('ОБНАРУЖЕНА ПОДМЕНА КАЧЕСТВА! originalUrl != finalUrl');
                    log('originalUrl =', originalUrl);
                    log('finalUrl    =', finalUrl);
                } else {
                    log('Подмены качества не будет (url останется как есть)');
                }

                if (data.playlist && data.playlist.length) {
                    log('data.playlist элементов:', data.playlist.length);
                    data.playlist.forEach(function (it, i) {
                        log('  #' + i, it.title || '', '| == originalUrl:', it.url === originalUrl, '| == finalUrl:', it.url === finalUrl);
                    });

                    if (finalUrl !== originalUrl) {
                        var match = data.playlist.filter(function (it) { return it.url === originalUrl; })[0];
                        if (match) {
                            log('FIX: подменяю url элемента плейлиста "' + (match.title || '') + '" на url выбранного качества');
                            match.url = finalUrl;
                        } else {
                            log('WARNING: не нашёл в playlist элемент с url === originalUrl, фикс №1 не применён');
                        }
                    }
                } else {
                    log('data.playlist пуст или отсутствует на этапе create');
                }
            } catch (err) {
                log('ОШИБКА в обработчике create:', err && err.message);
            }
        });

        log('Фикс №1 (подмена качества) подключён к Lampa.Player.listener');
        return true;
    }

    // ---------- ФИКС №2: запасной нечёткий матчинг на PlayerPlaylist ----------

    var lastRawUrl = null;

    function patchPlayerPlaylist() {
        if (!window.Lampa || !Lampa.PlayerPlaylist) return false;

        var pl = Lampa.PlayerPlaylist;
        if (pl.__autoselect_patched_v3__) return true;
        pl.__autoselect_patched_v3__ = true;

        var origUrl = pl.url;
        var origSet = pl.set;

        pl.url = function (u) {
            lastRawUrl = u;
            log('PlayerPlaylist.url() <-', u);
            try {
                var items = pl.get() || [];
                var match = findMatch(u, items);
                if (match && match.url !== u) {
                    log('-> нечёткое совпадение найдено, подставляю url элемента "' + (match.title || '') + '"');
                    u = match.url;
                }
            } catch (e) {
                log('ОШИБКА в url():', e && e.message);
            }
            return origUrl(u);
        };

        pl.set = function (p) {
            log('PlayerPlaylist.set() <- элементов:', (p || []).length);
            var res = origSet(p);
            try {
                if (lastRawUrl) {
                    var match = findMatch(lastRawUrl, p || []);
                    if (match) {
                        origUrl(match.url);
                        origSet(p);
                    } else {
                        log('set(): нечёткое совпадение для lastRawUrl не найдено');
                    }
                }
            } catch (e) {
                log('ОШИБКА в set():', e && e.message);
            }
            log('position() после set():', pl.position ? pl.position() : '?');
            return res;
        };

        log('Фикс №2 (нечёткий матчинг) подключён к Lampa.PlayerPlaylist');
        return true;
    }

    // ---------- ЗАПУСК ----------

    function tryPatchAll() {
        var ok1 = patchPlayerCreate();
        var ok2 = patchPlayerPlaylist();
        if (!ok1 || !ok2) {
            setTimeout(tryPatchAll, 500);
        }
    }

    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') tryPatchAll();
        });
    }
    tryPatchAll();

    document.addEventListener('DOMContentLoaded', ensureOverlay);
    setTimeout(ensureOverlay, 1000);
})();
