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

    // Вспомогательная функция для форсирования UI подсветки и галочки в HTML
    function forceVisualHighlight(targetIndex) {
        var checkCount = 0;
        var interval = setInterval(function() {
            checkCount++;
            // Ищем любые строки меню плейлиста
            var items = $('.player-playlist__item, .player-panel__playlist-item, [focusable]').filter(function() {
                var txt = $(this).text().toLowerCase();
                return txt.indexOf('эпизод') !== -1 || txt.indexOf('серия') !== -1;
            });

            if (items.length > 0) {
                // Пытаемся определить реальный порядковый номер серии
                // Так как прилетело '3', а серия 3-я, проверяем варианты совпадений
                var exactItem = items.eq(targetIndex);
                
                // Если балансер прислал индекс 3 для 3-й серии (хотя должен быть 2),
                // проверяем текст внутри плашки, чтобы не промахнуться
                items.each(function(i) {
                    var itemText = $(this).text().toLowerCase();
                    // Ищем строчку, где написано именно "эпизод 3" или "серия 3"
                    if (itemText.indexOf('эпизод ' + targetIndex) !== -1 || itemText.indexOf('серия ' + targetIndex) !== -1 || itemText.indexOf('эпизод: ' + targetIndex) !== -1) {
                        exactItem = $(this);
                    }
                });

                if (exactItem.length) {
                    writeLog('Интерфейс: Найдена нужная строка в меню. Принудительно выставляем галочку/активность.');
                    items.removeClass('active').removeClass('selected');
                    exactItem.addClass('active').addClass('selected');
                    
                    // Симулируем клик, чтобы Lampa проставила свою внутреннюю белую галочку
                    if (!exactItem.hasClass('has-check')) {
                        exactItem.trigger('click');
                        exactItem.addClass('has-check');
                    }

                    clearInterval(interval);
                }
            }

            if (checkCount > 20) clearInterval(interval); // Прекращаем поиск через 6 секунд
        }, 300);
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

            // Запускаем умный визуальный поиск и переклик строки в меню
            forceVisualHighlight(currentIndex);

            // Если в localStorage УЖЕ есть запись, и она отличается от текущей
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
                    forceVisualHighlight(listIdx);
                    return;
                }
            }

            var currentFileIdx = getFileIndex(data.url, items);
            saveTrackState(hash, currentFileIdx, currentIndex);

            if (currentIndex !== -1 && Lampa.Player.render) {
                Lampa.Player.render.playlist_index = currentIndex;
            }

        } catch (e) {
            writeLog('Ошибка в START: ' + e.message);
        }
    });

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
            forceVisualHighlight(listIdx);
        } catch(e) {}
    });

})();
