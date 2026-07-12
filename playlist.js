(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.85); color:#00ff00; padding:10px; font-family:monospace; font-size:12px; z-index:99999; max-width:400px; max-height:300px; overflow-y:auto; border:1px solid #00ff00; pointer-events:none;">[Plugin Init] Логи плейлиста...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Playlist Log]', text);
    }

    // Хелпер для создания уникального ключа на основе названия сериала
    function getStorageKey(data) {
        var name = data.title || (data.movie && data.movie.title) || 'unknown';
        // Убираем пробелы и спецсимволы, чтобы сделать чистый ключ
        return 'lampa_playlist_hist_' + name.replace(/[^a-zа-я0-9]/gi, '_').toLowerCase();
    }

    // Ищем плейлист во всех возможных структурах Lampa
    function getPlaylistArray(data) {
        var pl = data.playlist;
        if (pl && pl.length) return pl;
        
        if (Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            pl = Lampa.Player.playlist();
            if (pl && pl.length) return pl;
        }
        
        if (data.movie && data.movie.playlist) {
            pl = data.movie.playlist;
            if (pl && pl.length) return pl;
        }
        return null;
    }

    // Поиск индекса серии (сначала по названию, потом по URL)
    function findEpisodeIndex(playlist, currentItem) {
        if (!playlist || !currentItem) return -1;
        
        var currentTitle = currentItem.subtitle || currentItem.title || '';
        
        // 1. Пытаемся найти по точному названию серии (например, "1 серия" или "Серия 1")
        var index = playlist.findIndex(function(item) {
            var itemTitle = item.subtitle || item.title || '';
            return itemTitle && currentTitle && itemTitle.trim() === currentTitle.trim();
        });

        // 2. Если по названию не нашли, ищем по URL
        if (index === -1 && currentItem.url) {
            index = playlist.findIndex(function(item) {
                return item.url === currentItem.url;
            });
        }
        return index;
    }

    function restoreLastEpisode(data) {
        if (!data) return;
        
        var playlist = getPlaylistArray(data);
        if (!playlist || playlist.length <= 1) {
            writeLog('Start: Плейлист не найден или содержит 1 элемент. Завершаем работу.');
            return;
        }
        
        var storageKey = getStorageKey(data);
        writeLog('Start: Ключ истории: ' + storageKey + ' (Всего серий: ' + playlist.length + ')');

        var savedHistory = null;
        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        if (!savedHistory) {
            writeLog('History: История для этого сериала еще не создана.');
            return;
        }

        writeLog('History: Найдено в базе -> ' + (savedHistory.subtitle || savedHistory.title) + ' на ' + Math.round(savedHistory.time) + ' сек.');

        // Проверяем, совпадает ли то, что запущено сейчас, с тем, что сохранено
        var currentEpIndex = findEpisodeIndex(playlist, data);
        var savedEpIndex = findEpisodeIndex(playlist, savedHistory);

        writeLog('Restore: Текущий индекс серии = ' + currentEpIndex + ', Сохраненный индекс = ' + savedEpIndex);

        if (savedEpIndex !== -1 && currentEpIndex !== savedEpIndex) {
            writeLog('Restore: МЕНЯЕМ серию на сохраненную (Индекс ' + savedEpIndex + ')');
            
            var targetEpisode = playlist[savedEpIndex];
            data.url = targetEpisode.url;
            data.title = targetEpisode.title || data.title;
            data.subtitle = targetEpisode.subtitle || data.subtitle;
            
            if (typeof Lampa.Player.playlistIndex === 'function') {
                Lampa.Player.playlistIndex(savedEpIndex);
            }
        }

        // Подтягиваем время
        if (savedHistory.time && findEpisodeIndex(playlist, data) === savedEpIndex) {
            data.timeline = { time: savedHistory.time };
            if (data.movie) data.movie.time = savedHistory.time;
            writeLog('Restore: Время успешно выставлено: ' + Math.round(savedHistory.time) + ' сек.');
        }
    }

    function injectNavigation(data) {
        if (!data) return;
        var playlist = getPlaylistArray(data);
        if (!playlist || playlist.length <= 1) return;

        var currentIndex = findEpisodeIndex(playlist, data);
        writeLog('Nav: Пересчет кнопок навигации. Текущий индекс серии = ' + currentIndex);

        if (currentIndex === -1) return;

        // Кнопка СЛЕДУЮЩАЯ
        if (currentIndex < playlist.length - 1) {
            data.next = function() {
                var nextIndex = currentIndex + 1;
                writeLog('Nav Click: Переход на след. серию -> Индекс: ' + nextIndex);
                
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(nextIndex);
                
                var nextEpisode = playlist[nextIndex];
                var nextData = Object.assign({}, data, {
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

        // Кнопка ПРЕДЫДУЩАЯ
        if (currentIndex > 0) {
            data.prev = function() {
                var prevIndex = currentIndex - 1;
                writeLog('Nav Click: Переход на пред. серию -> Индекс: ' + prevIndex);
                
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(prevIndex);
                
                var prevEpisode = playlist[prevIndex];
                var prevData = Object.assign({}, data, {
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

    // Подписки
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

        var playlist = getPlaylistArray(currentData);
        if (!playlist || playlist.length <= 1) return; // Не пишем таймлайн для одиночных фильмов

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 3) return;

        var storageKey = getStorageKey(currentData);
        
        var historyState = {
            url: currentData.url,
            title: currentData.title,
            subtitle: currentData.subtitle,
            time: videoElement.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(historyState));
        
        if (Math.round(videoElement.currentTime) % 15 === 0) {
            writeLog('Save: Сохранено время ' + Math.round(videoElement.currentTime) + ' сек. для серии: ' + (currentData.subtitle || currentData.title));
        }
    });

})();
