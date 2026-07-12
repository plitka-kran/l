(function () {
    'use strict';

    // Функция для поиска и синхронизации активной серии в меню плеера
    function syncPlaylistSelection(data) {
        if (!data) return;

        // Ищем плейлист во всех возможных местах
        var playlist = data.playlist;
        if (!playlist && data.movie && data.movie.playlist) playlist = data.movie.playlist;
        if (!playlist && Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            try { playlist = Lampa.Player.playlist(); } catch(e){}
        }

        if (!playlist || !playlist.length) return;

        // Определяем реальный индекс текущей серии (по переданному ID или по URL файла)
        var currentIndex = -1;
        if (data.id !== undefined && playlist[data.id]) {
            currentIndex = parseInt(data.id);
        } else {
            currentIndex = playlist.findIndex(function(item) {
                return item.url === data.url;
            });
        }

        // Если индекс успешно найден — жестко заставляем Lampa перевести маркер выделения на него
        if (currentIndex !== -1) {
            
            // 1. Меняем индекс в ядре плеера
            if (typeof Lampa.Player.playlistIndex === 'function') {
                try { Lampa.Player.playlistIndex(currentIndex); } catch(e){}
            }
            
            // 2. Меняем индекс в модуле отображения интерфейса (отвечает за синюю подсветку на фото)
            if (Lampa.Player.render && Lampa.Player.render.playlist_index !== undefined) {
                Lampa.Player.render.playlist_index = currentIndex;
            }

            // 3. Форсируем обновление UI, если меню уже открыто на экране
            if (Lampa.Player.render && typeof Lampa.Player.render.playlistUpdate === 'function') {
                try { Lampa.Player.render.playlistUpdate(); } catch(e){}
            }
        }
    }

    // Вешаем синхронизацию на старт плеера
    Lampa.Player.listener.follow('start', function (data) {
        syncPlaylistSelection(data);
        
        // Даем микро-задержку в 200мс, так как меню серий может инициализироваться чуть позже самого видео
        setTimeout(function() {
            var currentData = Lampa.Player.data || data;
            syncPlaylistSelection(currentData);
        }, 200);
    });

    // Вешаем синхронизацию на переключение серий (когда включается следующая)
    Lampa.Player.listener.follow('change', function(data) {
        syncPlaylistSelection(data);
    });

})();
