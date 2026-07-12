(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.85); color:#00ff00; padding:10px; font-family:monospace; font-size:12px; z-index:99999; max-width:400px; max-height:300px; overflow-y:auto; border:1px solid #00ff00; pointer-events:none;">[Plugin Init] Поиск плейлиста...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Playlist Log]', text);
    }

    // Ключ на основе базового названия контента
    function getStorageKey(data) {
        var name = 'unknown';
        if (data.movie && data.movie.title) name = data.movie.title;
        else if (data.object && data.object.title) name = data.object.title;
        else if (data.title) name = data.title;
        
        return 'lampa_custom_pl_' + name.replace(/[^a-zа-я0-9]/gi, '_').toLowerCase();
    }

    // Глубокий поиск массива плейлиста
    function findPlaylist(data) {
        if (data.playlist && data.playlist.length) return data.playlist;
        if (data.movie && data.movie.playlist && data.movie.playlist.length) return data.movie.playlist;
        if (data.object && data.object.playlist && data.object.playlist.length) return data.object.playlist;
        
        // Поиск внутри сезонов, если структура сложная
        if (data.movie && data.movie.seasons) {
            writeLog('Playlist: Найдена структура сезонов, ищем серии...');
        }
        
        if (Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            var pl = Lampa.Player.playlist();
            if (pl && pl.length) return pl;
        }
        return null;
    }

    function restoreLastEpisode(data) {
        if (!data) return;
        
        var playlist = findPlaylist(data);
        var storageKey = getStorageKey(data);
        
        if (!playlist) {
            writeLog('Start: Массив плейлиста не обнаружен в data.movie или data.object');
            // Выведем ключи объекта для дебага, чтобы понять где прячутся серии
            writeLog('Debug data keys: ' + Object.keys(data).join(', '));
            if (data.movie) writeLog('Debug movie keys: ' + Object.keys(data.movie).join(', '));
            return;
        }

        writeLog('Playlist: Успешно найден! Серий в списке: ' + playlist.length);

        var savedHistory = null;
        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        if (!savedHistory) {
            writeLog('History: Локальная история для этого сериала пуста.');
            return;
        }

        writeLog('History: Последняя просмотренная серия (индекс/id): ' + savedHistory.savedId + ' на ' + Math.round(savedHistory.time) + ' сек.');

        // Вычисляем текущий индекс (раз id=3 это 3-я серия, проверим как соотносятся id или индексы)
        var currentIdx = data.id !== undefined ? data.id : playlist.findIndex(function(i) { return i.url === data.url; });
        var savedIdx = savedHistory.savedId;

        if (savedIdx !== undefined && currentIdx !== savedIdx && playlist[savedIdx]) {
            writeLog('Restore: Выполняем автопереключение на серию с индексом ' + savedIdx);
            
            var target = playlist[savedIdx];
            data.id = savedIdx; // Подменяем ID на сохраненный
            data.url = target.url;
            data.title = target.title || data.title;
            if (target.subtitle) data.subtitle = target.subtitle;
        }

        if (savedHistory.time && (data.id === savedIdx || playlist[savedIdx] && playlist[savedIdx].url === data.url)) {
            data.timeline = { time: savedHistory.time };
            if (data.movie) data.movie.time = savedHistory.time;
            writeLog('Restore: Таймлайн восстановлен на ' + Math.round(savedHistory.time) + ' сек.');
        }
    }

    function injectNavigation(data) {
        if (!data) return;
        var playlist = findPlaylist(data);
        if (!playlist || playlist.length <= 1) return;

        // Определяем текущий индекс на основе переданного id серии
        var currentIndex = data.id !== undefined ? parseInt(data.id) : playlist.findIndex(function(item) {
            return item.url === data.url;
        });
        
        // Если индекс съехал (например серии начинаются с 1, а не с 0)
        if (currentIndex !== -1 && !playlist[currentIndex]) {
            currentIndex = playlist.findIndex(function(item) { return item.url === data.url; });
        }

        writeLog('Nav: Текущий вычисленный индекс серии = ' + currentIndex);
        if (currentIndex === -1 || !playlist[currentIndex]) return;

        // Навешиваем событие СЛЕДУЮЩАЯ СЕРИЯ
        if (currentIndex < playlist.length - 1) {
            data.next = function() {
                var nextIndex = currentIndex + 1;
                writeLog('Nav Клик: Запуск следующей серии -> Индекс: ' + nextIndex);
                
                var nextEpisode = playlist[nextIndex];
                var nextData = Object.assign({}, data, {
                    id: nextIndex,
                    url: nextEpisode.url,
                    title: nextEpisode.title || data.title,
                    subtitle: nextEpisode.subtitle || data.subtitle,
                    timeline: { time: 0 }
                });
                if (nextData.movie) nextData.movie.time = 0;

                Lampa.Player.play(nextData);
            };
        } else {
            data.next = false;
        }

        // Навешиваем событие ПРЕДЫДУЩАЯ СЕРИЯ
        if (currentIndex > 0) {
            data.prev = function() {
                var prevIndex = currentIndex - 1;
                writeLog('Nav Клик: Запуск предыдущей серии -> Индекс: ' + prevIndex);
                
                var prevEpisode = playlist[prevIndex];
                var prevData = Object.assign({}, data, {
                    id: prevIndex,
                    url: prevEpisode.url,
                    title: prevEpisode.title || data.title,
                    subtitle: prevEpisode.subtitle || data.subtitle,
                    timeline: { time: 0 }
                });
                if (prevData.movie) prevData.movie.time = 0;

                Lampa.Player.play(prevData);
            };
        } else {
            data.prev = false;
        }
    }

    // Подписки на события Lampa
    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        restoreLastEpisode(data);
        injectNavigation(data);
    });

    Lampa.Player.listener.follow('change', function(data) {
        writeLog('--- СОБЫТИЕ CHANGE ---');
        injectNavigation(data);
    });

    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data();
        if (!currentData) return;

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 3) return;

        var storageKey = getStorageKey(currentData);
        
        var historyState = {
            savedId: currentData.id, // Сохраняем тот самый ID (номер серии)
            url: currentData.url,
            title: currentData.title,
            subtitle: currentData.subtitle,
            time: videoElement.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(historyState));
        
        if (Math.round(videoElement.currentTime) % 15 === 0) {
            writeLog('Save: Серия ID=' + currentData.id + ', Время=' + Math.round(videoElement.currentTime) + ' сек.');
        }
    });

})();
