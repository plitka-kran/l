(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.85); color:#00ff00; padding:10px; font-family:monospace; font-size:12px; z-index:99999; max-width:400px; max-height:300px; overflow-y:auto; border:1px solid #00ff00; pointer-events:none;">[Plugin Init] Низкоуровневый перехват...</div>');
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

    function playEpisodeAtIndex(playlist, index, oldData) {
        if (!playlist || !playlist[index]) return;
        writeLog('Запуск серии: Индекс ' + index + ' (' + (playlist[index].title || 'Без названия') + ')');

        var targetEpisode = playlist[index];
        var newData = Object.assign({}, oldData, {
            id: index,
            url: targetEpisode.url,
            title: targetEpisode.title || oldData.title,
            subtitle: targetEpisode.subtitle || targetEpisode.title || '',
            timeline: { time: 0 }
        });
        
        if (newData.movie) newData.movie.time = 0;

        // Полностью гасим текущий плеер перед перезапуском, чтобы избежать конфликтов запущенных инстансов
        if (Lampa.PlayerVideo && typeof Lampa.PlayerVideo.destroy === 'function') {
            Lampa.PlayerVideo.destroy();
        }

        Lampa.Player.play(newData);
    }

    // Принудительное внедрение в UI-элементы интерфейса Lampa
    function injectUIListeners(data) {
        var playlist = findPlaylist(data);
        if (!playlist || playlist.length <= 1) return;

        // Даем интерфейсу Lampa 300мс на отрисовку кнопок на экране
        setTimeout(function() {
            var currentIndex = findCurrentIndex(playlist, Lampa.Player.data() || data);
            if (currentIndex === -1) return;

            writeLog('UI Инъекция: Текущая серия в плеере: ' + currentIndex);

            // Отвязываем старые обработчики Lampa от кнопок "Вперед"/"Назад" на экране и вешаем свои
            $('.player-next, .player-panel__next').off('click').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var nextIndex = currentIndex + 1;
                if (nextIndex < playlist.length) {
                    writeLog('UI Клик: Нажата кнопка СЛЕДУЮЩАЯ -> Индекс: ' + nextIndex);
                    playEpisodeAtIndex(playlist, nextIndex, data);
                }
            });

            $('.player-prev, .player-panel__prev').off('click').on('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var prevIndex = currentIndex - 1;
                if (prevIndex >= 0) {
                    writeLog('UI Клик: Нажата кнопка ПРЕДЫДУЩАЯ -> Индекс: ' + prevIndex);
                    playEpisodeAtIndex(playlist, prevIndex, data);
                }
            });

            // Перехватываем также события пульта/клавиатуры через внутренний контроллер Lampa
            if (Lampa.Controller && Lampa.Controller.listener) {
                Lampa.Controller.listener.follow('keydown', function(e) {
                    // Коды клавиш переключения треков/серий на пультах (MediaNext / MediaPrevious)
                    if (e.code === 'MediaTrackNext' || e.keyCode === 425) {
                        $('.player-next').click();
                    }
                    if (e.code === 'MediaTrackPrevious' || e.keyCode === 424) {
                        $('.player-prev').click();
                    }
                });
            }

            writeLog('UI Инъекция: Кнопки на экране успешно перехвачены.');
        }, 300);
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

        if (savedIdx !== undefined && currentIdx !== savedIdx && playlist[savedIdx]) {
            writeLog('История: Найдена серия ' + savedIdx + '. Подменяем ссылку старта...');
            
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

        if (savedHistory.time && currentIdx === savedIdx) {
            data.timeline = { time: savedHistory.time };
            if (data.movie) data.movie.time = savedHistory.time;
            writeLog('История: Время восстановлено на ' + Math.round(savedHistory.time) + ' сек.');
        }
    }

    // Подписки на системные события Lampa
    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        restoreLastEpisode(data);
        injectUIListeners(data);
    });

    Lampa.Player.listener.follow('change', function(data) {
        writeLog('--- СОБЫТИЕ CHANGE ---');
        injectUIListeners(data);
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
            writeLog('Прогресс: Серия=' + historyState.savedId + ', Время=' + Math.round(videoElement.currentTime) + ' сек.');
        }
    });

})();
