(function () {
    'use strict';

    // Функция для поиска реального индекса серии в массиве
    function getCurrentIndex(data) {
        if (!data) return 0;
        var playlist = data.playlist || (data.movie && data.movie.playlist);
        if (!playlist && Lampa.Player && typeof Lampa.Player.playlist === 'function') {
            try { playlist = Lampa.Player.playlist(); } catch(e){}
        }
        if (!playlist || !playlist.length) return 0;

        if (data.id !== undefined && playlist[data.id]) {
            return parseInt(data.id);
        }
        
        var idx = playlist.findIndex(function(item) {
            return item.url === data.url;
        });
        return idx !== -1 ? idx : 0;
    }

    // Глобальный перехватчик рендеринга интерфейса Lampa
    Lampa.Player.listener.follow('start', function (data) {
        if (!data) return;

        // Ключевой хак: Ждем, пока Lampa создаст объект рендера (интерфейса)
        setTimeout(function() {
            if (Lampa.Player.render) {
                
                // Перехватываем стандартную функцию отрисовки плейлиста Lampa
                var originalPlaylistRender = Lampa.Player.render.playlist;
                
                Lampa.Player.render.playlist = function() {
                    // Перед тем как Lampa нарисует меню, принудительно вычисляем и подсовываем ей правильный индекс
                    var currentData = Lampa.Player.data || data;
                    var realIndex = getCurrentIndex(currentData);
                    
                    // Записываем индекс во все внутренние переменные отображения Lampa
                    Lampa.Player.render.playlist_index = realIndex;
                    if (typeof Lampa.Player.playlistIndex === 'function') {
                        try { Lampa.Player.playlistIndex(realIndex); } catch(e){}
                    }

                    // Вызываем оригинальный рендер Lampa, но уже с нашей правильной позицией
                    if (typeof originalPlaylistRender === 'function') {
                        originalPlaylistRender.apply(Lampa.Player.render, arguments);
                    }

                    // Дополнительный визуальный хак: ищем строчки меню в DOM и вручную переключаем класс выделения (active)
                    setTimeout(function() {
                        var items = $('.player-playlist__item, .player-panel__playlist-item');
                        if (items.length) {
                            items.removeClass('active'); // Снимаем выделение с 1-й серии
                            items.eq(realIndex).addClass('active'); // Вешаем на текущую (например, 3-ю)
                            
                            // Прокручиваем меню к активной серии, если список длинный
                            var activeItem = items.eq(realIndex);
                            if (activeItem.length && activeItem.parent().length) {
                                activeItem.parent().scrollTop(activeItem.position().top + activeItem.parent().scrollTop() - 100);
                            }
                        }
                    }, 50);
                };

                // Сразу же один раз принудительно вызываем наш обновленный рендер
                var currentData = Lampa.Player.data || data;
                Lampa.Player.render.playlist_index = getCurrentIndex(currentData);
            }
        }, 100);
    });

    // Дублируем логику при смене серии (если включилась следующая)
    Lampa.Player.listener.follow('change', function(data) {
        if (Lampa.Player.render) {
            var realIndex = getCurrentIndex(Lampa.Player.data || data);
            Lampa.Player.render.playlist_index = realIndex;
            
            var items = $('.player-playlist__item, .player-panel__playlist-item');
            if (items.length) {
                items.removeClass('active');
                items.eq(realIndex).addClass('active');
            }
        }
    });

})();
