(function () {
    'use strict';

    // Создаем блок для логов на экране
    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.85); color:#00ff00; padding:10px; font-family:monospace; font-size:12px; z-index:99999; max-width:400px; max-height:300px; overflow-y:auto; border:1px solid #00ff00; pointer-events:none;">[Plugin Init] Ожидание плеера...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Playlist Log]', text);
    }

    // Функция для поиска и переключения на сохраненную серию при старте
    function restoreLastEpisode(data) {
        if (!data) {
            writeLog('Start: Данные data отсутствуют');
            return;
        }
        writeLog('Start: ID=' + data.id + ', Method=' + data.method + ', URL=' + (data.url ? data.url.substring(0, 30) + '...' : 'нет'));

        if (!data.id || data.method !== 'tv') {
            writeLog('Start: Пропуск (не сериал или нет ID)');
            return;
        }

        var storageKey = 'lampa_playlist_history_' + data.id;
        var savedHistory = null;

        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {
            writeLog('Ошибка чтения localStorage: ' + e.message);
        }

        if (!savedHistory) {
            writeLog('History: История для ID ' + data.id + ' не найдена');
        } else {
            writeLog('History: Найдено в истории -> Серия: ' + savedHistory.title + ', Время: ' + savedHistory.time);
        }

        // Ищем плейлист во всех возможных местах
        var playlist = data.playlist;
        if (playlist) writeLog('Playlist: найден в data.playlist (' + playlist.length + ' эл.)');
        
        if (!playlist && Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            playlist = Lampa.Player.playlist();
            if (playlist) writeLog('Playlist: найден в Lampa.Player.playlist() (' + playlist.length + ' эл.)');
        }
        
        if (!playlist && data.movie && data.movie.playlist) {
            playlist = data.movie.playlist;
            if (playlist) writeLog('Playlist: найден в data.movie.playlist (' + playlist.length + ' эл.)');
        }

        if (!playlist || !playlist.length) {
            writeLog('Playlist: МАССИВ СЕРИЙ НЕ НАЙДЕН НИГДЕ!');
            return;
        }

        // Если есть история и текущий URL не совпадает с сохраненным
        if (savedHistory && data.url !== savedHistory.url) {
            var targetIndex = playlist.findIndex(function(item) {
                return item.url === savedHistory.url || (item.title && item.title === savedHistory.title);
            });

            if (targetIndex !== -1) {
                writeLog('Restore: Найдено совпадение! Индекс серии: ' + targetIndex + '. Переключаем...');
                data.url = playlist[targetIndex].url;
                data.title = playlist[targetIndex].title || data.title;
                if (playlist[targetIndex].subtitle) data.subtitle = playlist[targetIndex].subtitle;
                
                if (typeof Lampa.Player.playlistIndex === 'function') {
                    Lampa.Player.playlistIndex(targetIndex);
                    writeLog('Restore: Вызван Lampa.Player.playlistIndex()');
                }
            } else {
                writeLog('Restore: Сохраненная серия не найдена в текущем массиве плейлиста');
            }
        }

        if (savedHistory && savedHistory.time) {
            data.timeline = { time: savedHistory.time };
            if (data.movie) data.movie.time = savedHistory.time;
            writeLog('Restore: Время выставлено на ' + savedHistory.time + ' сек.');
        }
    }

    // Умная кастомная навигация по кнопкам внутри плеера
    function injectNavigation(data) {
        if (!data || !data.id) return;
        
        var playlist = data.playlist || (Lampa.Player && typeof Lampa.Player.playlist === 'function' ? Lampa.Player.playlist() : null);
        if (!playlist || playlist.length <= 1) return;

        var currentIndex = playlist.findIndex(function(item) {
            return item.url === data.url;
        });

        writeLog('Nav: Текущий индекс серии в плейлисте = ' + currentIndex);

        if (currentIndex === -1) return;

        // Переопределяем NEXT
        if (currentIndex < playlist.length - 1) {
            data.next = function() {
                var nextIndex = currentIndex + 1;
                writeLog('Nav Click: Клик «Следующая серия» -> Индекс: ' + nextIndex);
                
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(nextIndex);
                
                var nextData = Object.assign({}, data, {
                    url: playlist[nextIndex].url,
                    title: playlist[nextIndex].title || data.title,
                    subtitle: playlist[nextIndex].subtitle || data.subtitle,
                    timeline: { time: 0 }
                });
                if (nextData.movie) nextData.movie.time = 0;

                Lampa.Player.play(nextData);
            };
        }

        // Переопределяем PREV
        if (currentIndex > 0) {
            data.prev = function() {
                var prevIndex = currentIndex - 1;
                writeLog('Nav Click: Клик «Предыдущая серия» -> Индекс: ' + prevIndex);
                
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(prevIndex);
                
                var prevData = Object.assign({}, data, {
                    url: playlist[prevIndex].url,
                    title: playlist[prevIndex].title || data.title,
                    subtitle: playlist[prevIndex].subtitle || data.subtitle,
                    timeline: { time: 0 }
                });
                if (prevData.movie) prevData.movie.time = 0;

                Lampa.Player.play(prevData);
            };
        }
    }

    // Подписка на события плеера Lampa
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
        if (!currentData || !currentData.id || currentData.method !== 'tv') return;

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 3) return; 

        var storageKey = 'lampa_playlist_history_' + currentData.id;
        
        var historyState = {
            id: currentData.id,
            url: currentData.url,
            title: currentData.title,
            subtitle: currentData.subtitle,
            time: videoElement.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(historyState));
        
        // Чтобы не спамить в лог каждую секунду, пишем раз в 10 секунд
        if (Math.round(videoElement.currentTime) % 10 === 0) {
            writeLog('Save Time: ' + Math.round(videoElement.currentTime) + ' сек. записано в базу.');
        }
    });

})();
