(function () {
    'use strict';

    Lampa.Player.listener.follow('start', function (data) {
        if (!data) return;

        // Даем плееру 300 миллисекунд полностью загрузиться и построить плейлист
        setTimeout(function() {
            // 1. Находим массив серий
            var playlist = data.playlist || (data.movie && data.movie.playlist);
            if (!playlist || !playlist.length) return;

            // 2. Вычисляем индекс серии, которая РЕАЛЬНО сейчас играет
            var realIndex = -1;
            if (data.id !== undefined && playlist[data.id]) {
                realIndex = parseInt(data.id);
            } else {
                realIndex = playlist.findIndex(function(item) {
                    return item.url === data.url;
                });
            }

            // 3. Если индекс нашли, и он не равен 0 (ведь Lampa по дефолту ставит 0)
            if (realIndex > 0) {
                // Мягко меняем индекс в самом отображении интерфейса
                if (Lampa.Player.render) {
                    Lampa.Player.render.playlist_index = realIndex;
                }
                
                // Внутренне перекликиваем указатель Lampa на эту серию
                if (typeof Lampa.Player.playlistIndex === 'function') {
                    try {
                        // Передаем true вторым аргументом (если поддерживается), чтобы просто сдвинуть маркер без перезапуска видео
                        Lampa.Player.playlistIndex(realIndex, true); 
                    } catch(e) {}
                }

                // На всякий случай обновляем HTML-класс 'active' на плашке в меню, чтобы она посинела
                var items = $('.player-playlist__item, .player-panel__playlist-item');
                if (items.length) {
                    items.removeClass('active');
                    items.eq(realIndex).addClass('active');
                }
            }
        }, 300);
    });
})();
