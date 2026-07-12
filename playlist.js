/**
 * Lampa plugin: Torrent Playlist Track via LocalStorage (Event-Based Version)
 */
(function () {
    'use strict';

    if (window.__lampa_torrent_track_event_fix__) return;
    window.__lampa_torrent_track_event_fix__ = true;

    // Окно логов
    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.9); color:#00ff00; padding:10px; font-family:monospace; font-size:11px; z-index:99999; max-width:450px; max-height:350px; overflow-y:auto; border:1px solid #00ff00; line-height:1.4; pointer-events:none;">[Plugin Init] Старт плагина по событиям...</div>');
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

    writeLog('Система: Ожидание запуска плеера...');

    // Перехватываем событие СТАРТА плеера (когда Lampa только получила объект для воспроизведения)
    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        if (!data || !data.playlist) {
            writeLog('Предупреждение: Входящий плейлист пуст.');
            return;
        }

        try {
            var hash = getTorrentHash(data.url, data);
            var storageKey = 'lampa_torrent_track_' + hash;
            writeLog('Анализ торрента: Хэш = ' + hash);

            var savedTrack = JSON.parse(localStorage.getItem(storageKey));
            var items = data.playlist;

            // Находим текущий индекс того, что было нажато в меню "Файлы"
            var currentIndex = data.id !== undefined ? parseInt(data.id) : getFileIndex(data.url, items);
            writeLog('Фактически нажатый индекс серии: ' + currentIndex);

            // Если в localStorage есть сохраненный выбор, и он ОТЛИЧАЕТСЯ от нажатого
            if (savedTrack && savedTrack.index !== undefined && currentIndex !== savedTrack.index) {
                writeLog('LocalStorage: Найдена сохраненная серия с индексом: ' + savedTrack.index);
                
                // Ищем эту серию в текущем плейлисте по ее внутреннему индексу файла торрента
                var match = items.filter(function(it) {
                    return getFileIndex(it.url, items) === savedTrack.index;
                })[0];

                if (match) {
                    var listIdx = items.indexOf(match);
                    writeLog('Подмена: Найдено совпадение! Подменяем старт на элемент №' + listIdx + ' (' + (match.title || '') + ')');
                    
                    // Переписываем данные запуска прямо внутри объекта Lampa
                    data.id = listIdx;
                    data.url = match.url;
                    if (match.title) data.title = match.title;
                    
                    // Принудительно выставляем индекс для отображения галочки
                    if (Lampa.Player.render) {
                        Lampa.Player.render.playlist_index = listIdx;
                    }
                } else {
                    writeLog('Предупреждение: Сохраненный индекс файла не найден в плейлисте.');
                }
            } else {
                writeLog('Подмена не требуется (либо история пуста, либо запущена та же серия).');
                // На всякий случай фиксируем текущий индекс в UI для галочки
                if (currentIndex !== -1 && Lampa.Player.render) {
                    Lampa.Player.render.playlist_index = currentIndex;
                }
            }
        } catch (e) {
            writeLog('Ошибка в обработчике start: ' + e.message);
        }
    });

    // Ловим переключение серий (ручное или автоматическое), чтобы обновить localStorage
    Lampa.Player.listener.follow('change', function(data) {
        writeLog('--- СОБЫТИЕ CHANGE ---');
        if (!data) return;

        try {
            // Получаем актуальный плейлист из данных плеера
            var currentData = Lampa.Player.data || data;
            var items = currentData.playlist || [];
            
            var hash = getTorrentHash(currentData.url, currentData);
            var fileIdx = getFileIndex(currentData.url, items);

            if (hash && fileIdx !== -1) {
                var storageKey = 'lampa_torrent_track_' + hash;
                var state = { index: fileIdx, updated: Date.now() };
                
                localStorage.setItem(storageKey, JSON.stringify(state));
                writeLog('Сохранение: Записан индекс серии ' + fileIdx + ' для хэша ' + hash);

                // Намертво синхронизируем UI, чтобы галочка перепрыгнула на фото
                if (Lampa.Player.render) {
                    var listIdx = items.findIndex(function(it) { return it.url === currentData.url; });
                    if (listIdx === -1 && currentData.id !== undefined) listIdx = parseInt(currentData.id);
                    
                    if (listIdx !== -1) {
                        Lampa.Player.render.playlist_index = listIdx;
                        writeLog('UI Синхронизация галочки: playlist_index = ' + listIdx);
                    }
                }
            }
        } catch (e) {
            writeLog('Ошибка в обработчике change: ' + e.message);
        }
    });

})();
