(function () {
    'use strict';

    var targetIndexForClick = 0;
    var clickDone = false;

    // Ловим старт плеера и запоминаем, какая серия реально включилась
    Lampa.Player.listener.follow('start', function (data) {
        if (!data || !data.playlist) return;

        clickDone = false; // Сбрасываем флаг для нового видео
        
        var realIndex = -1;
        if (data.id !== undefined && data.playlist[data.id]) {
            realIndex = parseInt(data.id);
        } else {
            realIndex = data.playlist.findIndex(function(item) { return item.url === data.url; });
        }

        // Если это не первая серия (индекс > 0), запоминаем её для автоклика
        if (realIndex > 0) {
            targetIndexForClick = realIndex;
        } else {
            clickDone = true; // Для первой серии кликать не нужно
        }
    });

    // Следим за появлением меню на экране
    setInterval(function() {
        if (clickDone) return; // Если уже кликнули, ничего не делаем

        // Ищем элементы списка серий на экране
        var items = $('.player-playlist__item, .player-panel__playlist-item, [focusable]').filter(function() {
            var txt = $(this).text().toLowerCase();
            return txt.indexOf('эпизод') !== -1 || txt.indexOf('серия') !== -1;
        });

        // Как только меню появилось и отрендерилось
        if (items.length > 0 && items.eq(targetIndexForClick).length) {
            var targetItem = items.eq(targetIndexForClick);

            // Проверяем, что галочка еще НЕ стоит на этой серии (чтобы не кликать бесконечно)
            // Lampa отмечает активный пункт классом active или выбранным стилем
            if (!targetItem.hasClass('active') && !targetItem.hasClass('selected')) {
                
                // Виртуально «кликаем» по нужной строчке, как будто ты сам нажал на неё пультом
                targetItem.trigger('click');
                
                // Ставим флаг, что задача выполнена успешно
                clickDone = true;
            }
        }
    }, 300); // Проверяем экран каждые 300мс

    // Сбрасываем флаг при закрытии плеера
    Lampa.Player.listener.follow('destroy', function () {
        clickDone = false;
    });

})();
