(function () {
    'use strict';

    // Слушаем запуск плеера Lampa
    Lampa.Player.listener.follow('start', function (data) {
        if (!data || !data.id || data.method !== 'tv') return; // Работаем только с сериалами, у которых есть ID

        var storageKey = 'lampa_playlist_history_' + data.id;
        var savedHistory = null;

        try {
            savedHistory = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        // Если открыт плеер, но мы загрузили не то, что было сохранено, и у нас есть плейлист — делаем автопереключение
        if (data.playlist && data.playlist.length > 1) {
            
            // Проверяем, нужно ли восстановить конкретную серию из истории
            if (savedHistory && savedHistory.url && data.url !== savedHistory.url) {
                // Ищем сохраненную серию в текущем плейлисте по URL или по названию
                var targetIndex = data.playlist.findIndex(function(item) {
                    return item.url === savedHistory.url || (item.title && item.title === savedHistory.title);
                });

                if (targetIndex !== -1) {
                    var targetEpisode = data.playlist[targetIndex];
                    
                    // Переписываем текущие данные плеера на сохраненную серию
                    data.url = targetEpisode.url;
                    data.title = targetEpisode.title || data.title;
                    if (targetEpisode.subtitle) data.subtitle = targetEpisode.subtitle;
                    
                    // Подставляем таймлайн для восстановления секунды просмотра
                    if (savedHistory.time) {
                        data.timeline = {
                            time: savedHistory.time
                        };
                    }
                }
            } else if (savedHistory && savedHistory.time && data.url === savedHistory.url) {
                // Если серия совпадает, но плеер еще не применил время
                data.timeline = {
                    time: savedHistory.time
                };
            }

            // Добавляем или перезаписываем функции ручного/автоматического переключения серий стрелками
            injectNavigation(data);
        }
    });

    // Функция умной навигации по плейлисту (вперед / назад)
    function injectNavigation(data) {
        var playlist = data.playlist;
        
        // Находим индекс текущей серии в массиве
        var currentIndex = playlist.findIndex(function(item) {
            return item.url === data.url;
        });

        if (currentIndex === -1) return;

        // Если есть куда листать вперед (следующая серия)
        if (currentIndex < playlist.length - 1) {
            data.next = function() {
                var nextEpisode = playlist[currentIndex + 1];
                var nextData = Object.assign({}, data, {
                    url: nextEpisode.url,
                    title: nextEpisode.title || data.title,
                    subtitle: nextEpisode.subtitle || data.subtitle,
                    timeline: { time: 0 } // Новая серия стартует с 0
                });
                
                Lampa.Player.play(nextData);
            };
        } else {
            data.next = false; // Отключаем стрелку "вперед" на последней серии
        }

        // Если есть куда листать назад (предыдущая серия)
        if (currentIndex > 0) {
            data.prev = function() {
                var prevEpisode = playlist[currentIndex - 1];
                var prevData = Object.assign({}, data, {
                    url: prevEpisode.url,
                    title: prevEpisode.title || data.title,
                    subtitle: prevEpisode.subtitle || data.subtitle,
                    timeline: { time: 0 }
                });
                
                Lampa.Player.play(prevData);
            };
        } else {
            data.prev = false; // Отключаем стрелку "назад" на первой серии
        }
    }

    // Слушаем событие изменения прогресса или переключения внутри плеера для сохранения
    Lampa.Player.listener.follow('change', function(data) {
        if (!data || !data.id) return;
        injectNavigation(data); // Пересчитываем навигацию при смене серии
    });

    // Постоянно отслеживаем время просмотра и сохраняем в базу при выходе или переключении
    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data(); // Получаем метаданные того, что играет прямо сейчас
        
        if (!currentData || !currentData.id || currentData.method !== 'tv') return;

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 5) return; // Не сохраняем первые 5 секунд

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
