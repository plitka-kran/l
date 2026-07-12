(function () {
    'use strict';

    // Функция для генерации чистого ключа в localStorage на основе названия сериала
    function getStorageKey(data) {
        var name = 'unknown';
        if (data.movie && data.movie.title) name = data.movie.title;
        else if (data.object && data.object.title) name = data.object.title;
        else if (data.title) name = data.title;
        
        // Делаем безопасный ключ без пробелов и спецсимволов
        return 'lampa_playlist_track_' + name.replace(/[^a-zа-я0-9]/gi, '_').toLowerCase();
    }

    // Ловим самый первый момент инициализации трека в плеере
    Lampa.Player.listener.follow('start', function (data) {
        if (!data || !data.playlist) return;

        var storageKey = getStorageKey(data);
        var savedData = null;

        try {
            savedData = JSON.parse(localStorage.getItem(storageKey));
        } catch (e) {}

        // Вычисляем, какой индекс у серии, которую юзер ткнул в файлах сейчас
        var currentIndex = data.id !== undefined ? parseInt(data.id) : data.playlist.findIndex(function(item) { return item.url === data.url; });

        // Если в базе есть инфо о прошлой серии, и она НЕ совпадает с тем, что открывается сейчас
        if (savedData && savedData.index !== undefined && currentIndex !== savedData.index) {
            var targetIndex = savedData.index;

            if (data.playlist[targetIndex]) {
                var targetEpisode = data.playlist[targetIndex];
                
                // ПОДМЕНЯЕМ данные запуска для Lampa прямо на лету!
                data.id = targetIndex;
                data.url = targetEpisode.url;
                data.title = targetEpisode.title || data.title;
                if (targetEpisode.subtitle) data.subtitle = targetEpisode.subtitle;
                
                // Если было сохранено время внутри серии, подтягиваем и его
                if (savedData.time) {
                    data.timeline = { time: savedData.time };
                    if (data.movie) data.movie.time = savedData.time;
                }
                
                // Фиксируем в рендере Lampa актуальный индекс для галочки
                if (Lampa.Player.render) {
                    Lampa.Player.render.playlist_index = targetIndex;
                }
                return;
            }
        }

        // Если открылась актуальная серия, просто фиксируем её индекс в рендере для правильной галочки
        if (currentIndex !== -1 && Lampa.Player.render) {
            Lampa.Player.render.playlist_index = currentIndex;
        }
    });

    // Следим за изменением серии (когда ты кликаешь в плейлисте или срабатывает автопереключение)
    Lampa.Player.listener.follow('change', function(data) {
        if (!data || !data.playlist) return;
        
        var currentIndex = data.id !== undefined ? parseInt(data.id) : data.playlist.findIndex(function(item) { return item.url === data.url; });
        
        if (currentIndex !== -1) {
            var storageKey = getStorageKey(data);
            var state = {
                index: currentIndex,
                url: data.url,
                time: 0,
                updated: Date.now()
            };
            localStorage.setItem(storageKey, JSON.stringify(state));
            
            if (Lampa.Player.render) {
                Lampa.Player.render.playlist_index = currentIndex;
            }
        }
    });

    // Запоминаем текущее время (секунды) внутри серии, обновляя запись в localStorage
    Lampa.PlayerVideo.listener.follow('timeupdate', function(videoData) {
        var currentData = Lampa.Player.data; // Получаем статичные данные плеера
        if (!currentData || !currentData.playlist) return;

        var videoElement = Lampa.PlayerVideo.video();
        if (!videoElement || videoElement.currentTime < 5) return; // Начинаем писать после 5 сек просмотра

        var currentIndex = currentData.id !== undefined ? parseInt(currentData.id) : currentData.playlist.findIndex(function(item) { return item.url === currentData.url; });
        if (currentIndex === -1) return;

        var storageKey = getStorageKey(currentData);
        var state = {
            index: currentIndex,
            url: currentData.url,
            time: videoElement.currentTime,
            updated: Date.now()
        };

        localStorage.setItem(storageKey, JSON.stringify(state));
    });

})();
