/**
 * Lampa plugin: Torrent Playlist Track via LocalStorage (With Logs)
 */
(function () {
    'use strict';

    if (window.__lampa_torrent_track_fix__) return;
    window.__lampa_torrent_track_fix__ = true;

    // Создаем окно логов на экране
    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.9); color:#00ff00; padding:10px; font-family:monospace; font-size:11px; z-index:99999; max-width:450px; max-height:350px; overflow-y:auto; border:1px solid #00ff00; line-height:1.4; pointer-events:none;">[Plugin Init] Логирование дорожек серий...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Torrent Track]', text);
    }

    var IDENTITY_PARAMS = ['link', 'hash', 'id'];

    function safeDecode(s) {
        try { return decodeURIComponent(s); } catch (e) { return s; }
    }

    function parseQuery(url) {
        var q = {};
        if (!url) return q;
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

    function getTorrentHash(url) {
        var q = parseQuery(url);
        for (var i = 0; i < IDENTITY_PARAMS.length; i++) {
            var p = IDENTITY_PARAMS[i];
            if (q[p] !== undefined) return q[p];
        }
        var currentData = window.Lampa && Lampa.Player && Lampa.Player.data;
        var name = currentData && (currentData.title || (currentData.movie && currentData.movie.title)) || 'unknown_serial';
        return name.replace(/[^a-zа-я0-9]/gi, '_').toLowerCase();
    }

    function getFileIndex(url, playlistItems) {
        var q = parseQuery(url);
        var idx = q['index'] || q['file_index'] || q['fi'];
        if (idx !== undefined) return parseInt(idx);

        if (playlistItems && playlistItems.length) {
            return playlistItems.findIndex(function(it) { return it.url === url; });
        }
        return -1;
    }

    function patch() {
        if (!window.Lampa || !Lampa.Player || typeof Lampa.Player.playlist !== 'function') {
            return setTimeout(patch, 500);
        }

        var pl;
        try { pl = Lampa.Player.playlist(); } catch(e) { return setTimeout(patch, 500); }

        if (!pl || pl.__torrent_track_patched__) return;
        pl.__torrent_track_patched__ = true;

        writeLog('Система: Модуль Lampa.Player.playlist успешно пропатчен.');

        var origUrl = pl.url;
        var origSet = pl.set;

        // Перехват старта/установки URL
        pl.url = function (u) {
            try {
                var hash = getTorrentHash(u);
                var storageKey = 'lampa_torrent_track_' + hash;
                writeLog('Запуск: Обнаружен хэш раздачи: ' + hash);

                var savedTrack = JSON.parse(localStorage.getItem(storageKey));
                var items = pl.get() || [];

                if (savedTrack && savedTrack.index !== undefined) {
                    writeLog('LocalStorage: Найдена сохраненная дорожка серии с индексом файла: ' + savedTrack.index);
                    
                    var match = items.filter(function(it) {
                        return getFileIndex(it.url, items) === savedTrack.index;
                    })[0];

                    if (match) {
                        var listIdx = items.indexOf(match);
                        writeLog('Подмена: Найдено совпадение в текущем плейлисте. Переключаем на элемент №' + listIdx);
                        u = match.url;
                        
                        if (Lampa.Player.render) {
                            Lampa.Player.render.playlist_index = listIdx;
                        }
                    } else {
                        writeLog('Предупреждение: Файл с сохраненным индексом не найден в новом плейлисте.');
                    }
                } else {
                    writeLog('LocalStorage: История для этого хэша пуста.');
                }
            } catch (e) {
                writeLog('Ошибка в pl.url: ' + e.message);
            }
            return origUrl(u);
        };

        // Перехват смены содержимого плейлиста / ручного выбора
        pl.set = function (p) {
            var res = origSet(p);
            try {
                var currentData = Lampa.Player.data;
                if (currentData && currentData.url) {
                    var hash = getTorrentHash(currentData.url);
                    var fileIdx = getFileIndex(currentData.url, p || []);

                    if (hash && fileIdx !== -1) {
                        var storageKey = 'lampa_torrent_track_' + hash;
                        var state = { index: fileIdx, updated: Date.now() };
                        
                        localStorage.setItem(storageKey, JSON.stringify(state));
                        writeLog('Сохранение: Записан индекс активного файла ' + fileIdx + ' для хэша ' + hash);

                        if (Lampa.Player.render && p) {
                            var listIdx = p.findIndex(function(it) { return it.url === currentData.url; });
                            if (listIdx !== -1) {
                                Lampa.Player.render.playlist_index = listIdx;
                                writeLog('UI Синхронизация: Выставлен playlist_index = ' + listIdx);
                            }
                        }
                    }
                }
            } catch (e) {
                writeLog('Ошибка в pl.set: ' + e.message);
            }
            return res;
        };
    }

    // Дополнительное отслеживание смены серии в процессе воспроизведения
    Lampa.Player.listener.follow('change', function(data) {
        if (!data || !data.url) return;
        try {
            var hash = getTorrentHash(data.url);
            var items = (Lampa.Player.playlist && typeof Lampa.Player.playlist === 'function') ? Lampa.Player.playlist().get() : [];
            var fileIdx = getFileIndex(data.url, items);
            
            if (hash && fileIdx !== -1) {
                localStorage.setItem('lampa_torrent_track_' + hash, JSON.stringify({
                    index: fileIdx,
                    updated: Date.now()
                }));
                writeLog('Событие Change: Обновлен выбор серии -> Индекс файла: ' + fileIdx);
            }
        } catch(e){}
    });

    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') patch();
        });
    }

    patch();
})();
