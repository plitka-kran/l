// Простое добавление номера серии в панель плеера
(function() {
    'use strict';
    
    function addEpisodeToPanel() {
        // Ищем все элементы с названием в плеере
        var titles = document.querySelectorAll('.player-panel .title, .video-info .name, .player-video-info .title, .info .title');
        
        titles.forEach(function(el) {
            var text = el.textContent || '';
            // Если уже есть номер - пропускаем
            if (/\(\d+\s*серия\)/i.test(text)) return;
            
            // Ищем номер серии
            var match = text.match(/(\d+)\s*серия/i) || 
                       text.match(/S\d+E(\d+)/i) ||
                       text.match(/(\d+)x\d+/) ||
                       text.match(/\((\d+)\)/);
            
            if (match && match[1]) {
                // Убираем лишние пробелы и добавляем номер
                var cleanTitle = text.replace(/\(\d+\)/g, '').replace(/\s+/g, ' ').trim();
                el.textContent = cleanTitle + ' (' + match[1] + ' серия)';
                console.log('📺 Добавлен номер в панель:', el.textContent);
            }
        });
    }
    
    // Запускаем при открытии плеера
    if (Lampa && Lampa.Player && Lampa.Player.listener) {
        Lampa.Player.listener.follow('create', function() {
            setTimeout(addEpisodeToPanel, 200);
            setTimeout(addEpisodeToPanel, 500);
            setTimeout(addEpisodeToPanel, 1000);
        });
    }
    
    // Также запускаем по таймеру для надежности
    setInterval(function() {
        // Проверяем, открыт ли плеер
        if (document.querySelector('.player-panel, .video-info')) {
            addEpisodeToPanel();
        }
    }, 3000);
    
    console.log('✅ Скрипт для панели загружен!');
})();
