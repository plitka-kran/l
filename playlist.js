/**
 * Lampa plugin: Torrent Playlist Track via LocalStorage (Fixed Save)
 */
(function () {
    'use strict';

    if (window.__lampa_torrent_track_event_fix__) return;
    window.__lampa_torrent_track_event_fix__ = true;

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.9); color:#00ff00; padding:10px; font-family:monospace; font-size:11px; z-index:99999; max-width:450px; max-height:350px; overflow-y:auto; border:1px solid #00ff00; line-height:1.4; pointer-events:none;">[Plugin Init] Синхронизация истории...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Event Track]', text);
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

    function getTorrentHash(url, data) {
        var q = parseQuery(url);
        for (var i = 0; i < IDENTITY_PARAMS.length; i++) {
            var p = IDENTITY_PARAMS[i];
            if (q[p] !== undefined) return q[p];
        }
        var name = data && (data.title || (data.movie && data.movie.title)) || 'unknown_serial';
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

    // Сохранение состояния серии в localStorage
    function saveTrackState(hash, fileIdx, listIdx) {
        if (!hash || fileIdx === -1) return;
        var storageKey = 'lampa_torrent_track_' + hash;
        var state = { index: fileIdx, updated: Date.now() };
        localStorage.setItem(storageKey, JSON.stringify(state));
        writeLog('Сохранение: Индекс файла ' + fileIdx + ' (Позиция: ' + listIdx + ') успешно записан в память.');
    }

    writeLog('Система: Ожидание запуска плеера...');

    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        if (!data || !data.playlist) {
            writeLog('Предупреждение: Плейлист пуст.');
            return;
        }

        try {
            var hash = getTorrentHash(data.url, data);
            var storageKey = 'lampa_torrent_track_' + hash;
            writeLog('Анализ торрента: Хэш = ' + hash);

            var savedTrack = JSON.parse(localStorage.getItem(storageKey));
            var items = data.playlist;

            var currentIndex = data.id !== undefined ? parseInt(data.id) : getFileIndex(data.url, items);
            writeLog('Фактически нажатый индекс серии: ' + currentIndex);

            // Если в localStorage УЖЕ есть запись, и она отличается от того, что мы ткнули вручную
            if (savedTrack && savedTrack.index !== undefined && currentIndex !== savedTrack.index) {
                writeLog('LocalStorage: Найдена сохраненная серия с индексом файла: ' + savedTrack.index);
                
                var match = items.filter(function(it) {
                    return getFileIndex(it.url, items) === savedTrack.index;
                })[0];

                if (match) {
                    var listIdx = items.indexOf(match);
                    writeLog('Подмена: Переключаем старт на сохраненную серию №' + listIdx);
                    
                    data.id = listIdx;
                    data.url = match.url;
                    if (match.title) data.title = match.title;
                    
                    if (Lampa.Player.render) {
                        Lampa.Player.render.playlist_index = listIdx;
                    }
                    return; // Выходим, чтобы не перезаписать поверх новый ручной клик
                }
            }

            // ЕСЛИ записи в localStorage не было, или ты зашел в эту серию ПЕРВЫЙ раз:
            // Сразу же принудительно сохраняем её, чтобы в следующий раз плагин знал, где ты остановился!
            var currentFileIdx = getFileIndex(data.url, items);
            saveTrackState(hash, currentFileIdx, currentIndex);

            if (currentIndex !== -1 && Lampa.Player.render) {
                Lampa.Player.render.playlist_index = currentIndex;
            }

        } catch (e) {
            writeLog('Ошибка в START: ' + e.message);
        }
    });

    // Ловим переключение серий кнопками "вперед/назад" или автопереключением плеера
    Lampa.Player.listener.follow('change', function(data) {
        writeLog('--- СОБЫТИЕ CHANGE ---');
        var currentData = Lampa.Player.data || data;
        if (!currentData) return;

        try {
            var items = currentData.playlist || [];
            var hash = getTorrentHash(currentData.url, currentData);
            var fileIdx = getFileIndex(currentData.url, items);
            var listIdx = currentData.id !== undefined ? parseInt(currentData.id) : items.findIndex(function(it) { return it.url === currentData.url; });

            saveTrackState(hash, fileIdx, listIdx);

            if (Lampa.Player.render && listIdx !== -1) {
                Lampa.Player.render.playlist_index = listIdx;
            }
        } catch(e) {}
    });

    // Дополнительно обновляем запись во время воспроизведения (каждые пару секунд видео)
    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data;
        if (!currentData || !currentData.url) return;

        // Делаем запись раз в 15 секунд, чтобы не перегружать память устройства
        var videoElement = Lampa.PlayerVideo.video();
        if (videoElement && Math.round(videoElement.currentTime) % 15 === 0) {
            try {
                var items = currentData.playlist || [];
                var hash = getTorrentHash(currentData.url, currentData);
                var fileIdx = getFileIndex(currentData.url, items);
                
                var storageKey = 'lampa_torrent_track_' + hash;
                var state = { index: fileIdx, updated: Date.now() };
                localStorage.setItem(storageKey, JSON.stringify(state));
            } catch(e) {}
        }
    });

})();
