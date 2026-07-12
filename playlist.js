(function () {
    'use strict';

    // Функция для поиска и переключения на сохраненную серию при старте
    function restoreLastEpisode(data) {
        if (!data || !data.id || data.method !== 'tv') return;

        var storageKey = 'lampa_playlist_history_' + data.id;
        var savedHistory = null;

        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        if (!savedHistory) return;

        // Ищем плейлист. Он может быть в data.playlist или в глобальном плеере
        var playlist = data.playlist || (Lampa.Player && Lampa.Player.playlist ? Lampa.Player.playlist() : null);
        if (!playlist || !playlist.length) return;

        // Проверяем, играет ли сейчас НЕ та серия, что сохранена
        if (data.url !== savedHistory.url) {
            var targetIndex = playlist.findIndex(function(item) {
                return item.url === savedHistory.url || (item.title && item.title === savedHistory.title);
            });

            // Если нашли сохраненную серию в плейлисте — принудительно переключаем индекс Lampa
            if (targetIndex !== -1) {
                data.url = playlist[targetIndex].url;
                data.title = playlist[targetIndex].title || data.title;
                if (playlist[targetIndex].subtitle) data.subtitle = playlist[targetIndex].subtitle;
                
                // Устанавливаем индекс для корректной навигации самой Lampa
                if (typeof Lampa.Player.playlistIndex === 'function') {
                    Lampa.Player.playlistIndex(targetIndex);
                } else if (Lampa.Player.render && Lampa.Player.render.playlist_index !== undefined) {
                    Lampa.Player.render.playlist_index = targetIndex;
                }
            }
        }

        // Подсовываем время просмотра
        if (savedHistory.time && data.url === savedHistory.url) {
            data.timeline = {
                time: savedHistory.time
            };
            // Дополнительно форсируем старт с нужной секунды через встроенный механизм Lampa
            if (data.movie) {
                data.movie.time = savedHistory.time;
            }
        }
    }

    // Умная кастомная навигация по кнопкам внутри плеера
    function injectNavigation(data) {
        if (!data || !data.id) return;
        
        var playlist = data.playlist || (Lampa.Player && Lampa.Player.playlist ? Lampa.Player.playlist() : null);
        if (!playlist || playlist.length <= 1) return;

        var currentIndex = playlist.findIndex(function(item) {
            return item.url === data.url;
        });

        if (currentIndex === -1) return;

        // Переопределяем функцию перехода на СЛЕДУЮЩУЮ серию
        if (currentIndex < playlist.length - 1) {
            data.next = function() {
                var nextIndex = currentIndex + 1;
                var nextEpisode = playlist[nextIndex];
                
                // Обновляем индекс в плеере Lampa
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(nextIndex);
                
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

        // Переопределяем функцию перехода на ПРЕДЫДУЩУЮ серию
        if (currentIndex > 0) {
            data.prev = function() {
                var prevIndex = currentIndex - 1;
                var prevEpisode = playlist[prevIndex];
                
                if (typeof Lampa.Player.playlistIndex === 'function') Lampa.Player.playlistIndex(prevIndex);
                
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

    // Хук на самый старт плеера (до рендеринга потока)
    Lampa.Player.listener.follow('start', function (data) {
        restoreLastEpisode(data);
        injectNavigation(data);
    });

    // Хук на переключение серий стрелками внутри плеера
    Lampa.Player.listener.follow('change', function(data) {
        injectNavigation(data);
        
        // Принудительно сохраняем факт переключения на новую серию (сбрасываем время на 0)
        if (data && data.id && data.method === 'tv') {
            var storageKey = 'lampa_playlist_history_' + data.id;
            var historyState = {
                id: data.id,
                url: data.url,
                title: data.title,
                subtitle: data.subtitle,
                time: 0,
                updated: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(historyState));
        }
    });

    // Следим за временем воспроизведения и пишем в localStorage
    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data();
        if (!currentData || !currentData.id || currentData.method !== 'tv') return;

        var videoElement = Lampa.PlayerVideo.video();
        // Начинаем запоминать время, если прошло больше 3 секунд просмотра
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
    });

})();
