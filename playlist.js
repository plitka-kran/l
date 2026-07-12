(function () {
    'use strict';

    var logDiv = $('<div id="lampa-plugin-logs" style="position:fixed; top:10px; left:10px; background:rgba(0,0,0,0.9); color:#00ff00; padding:10px; font-family:monospace; font-size:11px; z-index:99999; max-width:450px; max-height:350px; overflow-y:auto; border:1px solid #00ff00; line-height:1.4; pointer-events:none;">[Plugin Log Init] Ожидание старта...</div>');
    $('body').append(logDiv);

    function writeLog(text) {
        var time = new Date().toLocaleTimeString();
        logDiv.append('<div>[' + time + '] ' + text + '</div>');
        logDiv.scrollTop(logDiv[0].scrollHeight);
        console.log('[Lampa Deep Log]', text);
    }

    Lampa.Player.listener.follow('start', function (data) {
        writeLog('--- СОБЫТИЕ START ---');
        if (!data) {
            writeLog('Ошибка: Объект data пуст');
            return;
        }

        // Логируем входящие данные серии
        writeLog('Входящие: id=' + data.id + ', url=' + (data.url ? 'Есть' : 'Нет') + ', method=' + data.method);

        // Даем плееру 400мс полностью инициализироваться
        setTimeout(function() {
            writeLog('--- Анализ структуры плеера ---');

            // 1. Проверяем наличие плейлиста в data
            var plData = data.playlist;
            var plMovie = data.movie && data.movie.playlist;
            writeLog('Плейлист в data.playlist: ' + (plData ? 'Найдено серий: ' + plData.length : 'Отсутствует'));
            writeLog('Плейлист в data.movie.playlist: ' + (plMovie ? 'Найдено серий: ' + plMovie.length : 'Отсутствует'));

            // 2. Проверяем плейлист в самом ядре Lampa
            if (Lampa.Player && typeof Lampa.Player.playlist === 'function') {
                try {
                    var corePL = Lampa.Player.playlist();
                    writeLog('Lampa.Player.playlist(): ' + (corePL ? 'Найдено серий: ' + corePL.length : 'Пусто/Null'));
                } catch(e) {
                    writeLog('Ошибка при вызове Lampa.Player.playlist(): ' + e.message);
                }
            } else {
                writeLog('Метод Lampa.Player.playlist отсутствует или это не функция');
            }

            // 3. Ищем, где именно сейчас находится внутренний индекс Lampa
            if (Lampa.Player.render) {
                writeLog('Текущий Lampa.Player.render.playlist_index = ' + Lampa.Player.render.playlist_index);
            } else {
                writeLog('Объект Lampa.Player.render отсутствует');
            }

            // 4. Проверяем доступность метода переключения индекса
            writeLog('Тип Lampa.Player.playlistIndex: ' + typeof Lampa.Player.playlistIndex);

            // Вычисляем реальный индекс
            var playlist = plData || plMovie;
            if (playlist && playlist.length) {
                var realIndex = -1;
                if (data.id !== undefined && playlist[data.id]) {
                    realIndex = parseInt(data.id);
                } else {
                    realIndex = playlist.findIndex(function(item) { return item.url === data.url; });
                }
                writeLog('Вычисленный реальный индекс для подсветки = ' + realIndex);

                if (realIndex > 0) {
                    writeLog('Пробуем принудительный сдвиг на индекс: ' + realIndex);
                    
                    if (Lampa.Player.render) {
                        Lampa.Player.render.playlist_index = realIndex;
                    }
                    if (typeof Lampa.Player.playlistIndex === 'function') {
                        try {
                            Lampa.Player.playlistIndex(realIndex);
                            writeLog('Вызван Lampa.Player.playlistIndex(' + realIndex + ')');
                        } catch(err) {
                            writeLog('Сбой при вызове playlistIndex: ' + err.message);
                        }
                    }

                    // Смотрим на HTML элементы бокового меню серий
                    var items = $('.player-playlist__item, .player-panel__playlist-item');
                    writeLog('Найдено HTML элементов серий в DOM: ' + items.length);
                    if (items.length) {
                        items.removeClass('active');
                        items.eq(realIndex).addClass('active');
                        writeLog('HTML класс active принудительно применен к элементу №' + realIndex);
                    }
                }
            } else {
                writeLog('Невозможно переключить индекс: Массив плейлиста не найден ни в одном источнике.');
            }

        }, 400);
    });

})();
