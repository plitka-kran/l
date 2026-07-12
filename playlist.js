(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.9); color:#00ff00; padding:10px; font-family:monospace; font-size:11px; z-index:99999; max-width:450px; max-height:350px; overflow-y:auto; border:1px solid #00ff00; line-height:1.4; pointer-events:none;">[Plugin Log] Слежение за UI...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Monitor Log]', text);
    }

    var targetIndexForHighlight = 0;

    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        if (!data) return;

        var playlist = data.playlist;
        if (!playlist || !playlist.length) return;

        // Вычисляем индекс серии (учитываем, что id=3 при плейлисте из 6 элементов — это скорее всего индекс 3)
        var realIndex = -1;
        if (data.id !== undefined && playlist[data.id]) {
            realIndex = parseInt(data.id);
        } else {
            realIndex = playlist.findIndex(function(item) { return item.url === data.url; });
        }

        if (realIndex === -1) realIndex = 0;
        
        targetIndexForHighlight = realIndex;
        writeLog('Запомнили индекс для подсветки: ' + targetIndexForHighlight);

        // Мягко пишем в рендер на случай, если Lampa его считает
        if (Lampa.Player.render) {
            Lampa.Player.render.playlist_index = targetIndexForHighlight;
        }
    });

    // Запускаем постоянный таймер, который проверяет появление бокового меню на экране
    setInterval(function() {
        // Ищем элементы серий (класс из стандартного плеера Lampa)
        var items = $('.player-playlist__item, .player-panel__playlist-item, .player-panel__index');
        
        if (items.length > 0) {
            // Проверяем, если до сих пор активна первая серия (индекс 0), а должна быть другая
            var currentActive = items.filter('.active').index();
            
            if (currentActive !== targetIndexForHighlight && items.eq(targetIndexForHighlight).length) {
                writeLog('UI Меню обнаружено! Переносим выделение с ' + currentActive + ' на ' + targetIndexForHighlight);
                
                // Снимаем синий маркер со всех серий
                items.removeClass('active');
                
                // Намертво красим в синий цвет нужную серию
                var activeItem = items.eq(targetIndexForHighlight);
                activeItem.addClass('active');

                // Пытаемся также найти родительский контейнер и прокрутить его к этой серии
                var parentContainer = activeItem.parent();
                if (parentContainer.length) {
                    parentContainer.scrollTop(activeItem.position().top + parentContainer.scrollTop() - 80);
                }
            }
        }
    }, 500); // Проверяем экран два раза в секунду

})();
