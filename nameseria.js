// Простое отображение названия с номером серии
(function() {
    'use strict';
    
    if (Lampa && Lampa.Player && Lampa.Player.listener) {
        Lampa.Player.listener.follow('create', function(e) {
            var data = e && e.data;
            if (data && data.title) {
                // Проверяем, есть ли номер серии
                var hasEpisode = /\((\d+)\s*серия\)/i.test(data.title);
                if (!hasEpisode) {
                    // Ищем номер в других форматах
                    var match = data.title.match(/(\d+)\s*серия/i) || 
                               data.title.match(/S\d+E(\d+)/i) ||
                               data.title.match(/(\d+)x\d+/);
                    
                    if (match && match[1]) {
                        data.title = data.title + ' (' + match[1] + ' серия)';
                        console.log('📺 Добавлен номер: ' + data.title);
                    }
                }
            }
        });
    }
    
    console.log('✅ Готово!');
})();
