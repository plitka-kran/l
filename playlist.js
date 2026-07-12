(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.85); color:#00ff00; padding:10px; font-family:monospace; font-size:12px; z-index:99999; max-width:400px; max-height:300px; overflow-y:auto; border:1px solid #00ff00; pointer-events:none;">[Plugin Init] Мониторинг плейлиста...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Playlist Log]', text);
    }

    function getStorageKey(data) {
        var name = 'unknown';
        if (data.movie && data.movie.title) name = data.movie.title;
        else if (data.object && data.object.title) name = data.object.title;
        else if (data.title) name = data.title;
        return 'lampa_custom_pl_' + name.replace(/[^a-zа-я0-9]/gi, '_').toLowerCase();
    }

    function findPlaylist(data) {
        if (data.playlist && data.playlist.length) return data.playlist;
        if (data.movie && data.movie.playlist && data.movie.playlist.length) return data.movie.playlist;
        if (data.object && data.object.playlist && data.object.playlist.length) return data.object.playlist;
        if (Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            var pl = Lampa.Player.playlist();
            if (pl && pl.length) return pl;
        }
        return null;
    }

    function findCurrentIndex(playlist, data) {
        if (data.id !== undefined && playlist[data.id]) return parseInt(data.id);
        return playlist.findIndex(function(item) {
            return item.url === data.url;
        });
    }

    // Функция для принудительного запуска выбранной серии
    function playEpisodeAtIndex(playlist, index, oldData) {
        if (!playlist || !playlist[index]) return;
        writeLog('Переключение: Запуск серии под индексом ' + index);

        var targetEpisode = playlist[index];
        
        // Формируем чистый объект данных для плеера Lampa
        var newData = Object.assign({}, oldData, {
            id: index,
            url: targetEpisode.url,
            title: targetEpisode.title || oldData.title,
            subtitle: targetEpisode.subtitle || targetEpisode.title || '',
            timeline: { time: 0 }
        });
        
        if (newData.movie) newData.movie.time = 0;

        // Перезапускаем плеер Lampa с новым файлом
        Lampa.Player.play(newData);
    }

    // Перехват кнопок «Вперед» / «Назад» на уровне ядра плеера Lampa
    function interceptPlayerControls(data) {
        var playlist = findPlaylist(data);
        if (!playlist || playlist.length <= 1) return;

        var currentIndex = findCurrentIndex(playlist, data);
        if (currentIndex === -1) return;

        // Хак: Подменяем стандартные методы Lampa на наши кастомные переключатели
        Lampa.Player.next = function() {
            var nextIndex = currentIndex + 1;
            if (nextIndex < playlist.length) {
                writeLog('Клик: Вперед -> Серия ' + nextIndex);
                playEpisodeAtIndex(playlist, nextIndex, data);
            } else {
                writeLog('Клик: Конец плейлиста, переключать некуда');
            }
        };

        Lampa.Player.prev = function() {
            var prevIndex = currentIndex - 1;
            if (prevIndex >= 0) {
                writeLog('Клик: Назад -> Серия ' + prevIndex);
                playEpisodeAtIndex(playlist, prevIndex, data);
            } else {
                writeLog('Клик: Это первая серия');
            }
        };
        
        writeLog('Инъекция: Методы Lampa.Player.next/prev успешно перехвачены.');
    }

    function restoreLastEpisode(data) {
        if (!data) return;
        
        var playlist = findPlaylist(data);
        if (!playlist || playlist.length <= 1) return;

        var storageKey = getStorageKey(data);
        var savedHistory = null;
        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        if (!savedHistory) return;

        var currentIdx = findCurrentIndex(playlist, data);
        var savedIdx = savedHistory.savedId;

        // Если открылась не та серия, которая сохранена в истории
        if (savedIdx !== undefined && currentIdx !== savedIdx && playlist[savedIdx]) {
            writeLog('Восстановление: Найдена прошлая серия ' + savedIdx + '. Подменяем старт...');
            
            var target = playlist[savedIdx];
            data.id = savedIdx;
            data.url = target.url;
            data.title = target.title || data.title;
            data.subtitle = target.subtitle || target.title || '';
            
            if (savedHistory.time) {
                data.timeline = { time: savedHistory.time };
                if (data.movie) data.movie.time = savedHistory.time;
            }
            return;
        }

        // Если серия совпала, но нужно выставить время
        if (savedHistory.time && currentIdx === savedIdx) {
            data.timeline = { time: savedHistory.time };
            if (data.movie) data.movie.time = savedHistory.time;
            writeLog('Восстановление: Время выставлено на ' + Math.round(savedHistory.time) + ' сек.');
        }
    }

    // Подписки на события
    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        restoreLastEpisode(data);
        interceptPlayerControls(data);
    });

    Lampa.Player.listener.follow('change', function(data) {
        writeLog('--- СОБЫТИЕ CHANGE ---');
        interceptPlayerControls(data);
    });

    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data();
        if (!currentData) return;

        var playlist = findPlaylist(currentData);
        if (!playlist || playlist.length <= 1) return;

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 3) return;

        var storageKey = getStorageKey(currentData);
        var currentIdx = findCurrentIndex(playlist, currentData);

        var historyState = {
            savedId: currentIdx !== -1 ? currentIdx : currentData.id,
            url: currentData.url,
            title: currentData.title,
            subtitle: currentData.subtitle,
            time: videoElement.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(historyState));
        
        if (Math.round(videoElement.currentTime) % 15 === 0) {
            writeLog('Сохранение: Индекс=' + historyState.savedId + ', Время=' + Math.round(videoElement.currentTime) + ' сек.');
        }
    });

})();
