// Lampa - Добавление номера серии в название
(function () {
    'use strict';

    if (window.__lampa_episode_number__) return;
    window.__lampa_episode_number__ = true;

    // ========= ФУНКЦИИ =========
    
    // Извлечение номера серии из названия
    function extractEpisode(title) {
        if (!title) return null;
        
        // Паттерны для поиска серии
        var patterns = [
            /\((\d+)\s*серия\)/i,
            /серия\s*(\d+)/i,
            /series\s*(\d+)/i,
            /episode\s*(\d+)/i,
            /ep\s*(\d+)/i,
            /#(\d+)/,
            /S\d+E(\d+)/i,
            /(\d+)x\d+/
        ];
        
        for (var i = 0; i < patterns.length; i++) {
            var match = title.match(patterns[i]);
            if (match && match[1]) {
                return parseInt(match[1]);
            }
        }
        return null;
    }

    // Добавление номера серии в название
    function addEpisodeNumber(title) {
        if (!title) return title;
        
        // Проверяем, есть ли уже номер серии
        if (/\((\d+)\s*серия\)/i.test(title)) {
            return title; // Уже есть номер
        }
        
        var episode = extractEpisode(title);
        if (episode) {
            // Добавляем номер в скобках
            return title + ' (' + episode + ' серия)';
        }
        
        return title;
    }

    // ========= ПАТЧИ ДЛЯ LAMPA =========
    
    // Изменение названия при создании плеера
    function patchPlayer() {
        if (!window.Lampa || !Lampa.Player) return false;
        
        if (Lampa.Player.__episode_number_patched__) return true;
        Lampa.Player.__episode_number_patched__ = true;
        
        // Следим за созданием плеера
        if (Lampa.Player.listener && typeof Lampa.Player.listener.follow === 'function') {
            Lampa.Player.listener.follow('create', function(e) {
                try {
                    var data = e && e.data;
                    if (data && data.title) {
                        var newTitle = addEpisodeNumber(data.title);
                        if (newTitle !== data.title) {
                            data.title = newTitle;
                            console.log('📺 Добавлен номер серии:', newTitle);
                        }
                    }
                } catch (err) {}
            });
        }
        
        // Перехват метода open
        if (Lampa.Player.open && typeof Lampa.Player.open === 'function') {
            var origOpen = Lampa.Player.open;
            Lampa.Player.open = function(params) {
                try {
                    if (params && params.title) {
                        params.title = addEpisodeNumber(params.title);
                    }
                } catch (e) {}
                return origOpen.call(this, params);
            };
        }
        
        return true;
    }

    // Изменение названия в плейлисте
    function patchPlaylist() {
        if (!window.Lampa || !Lampa.PlayerPlaylist) return false;
        
        if (Lampa.PlayerPlaylist.__episode_number_patched__) return true;
        Lampa.PlayerPlaylist.__episode_number_patched__ = true;
        
        // Изменяем каждый элемент плейлиста
        var origSet = Lampa.PlayerPlaylist.set;
        Lampa.PlayerPlaylist.set = function(playlist) {
            try {
                if (playlist && Array.isArray(playlist)) {
                    playlist.forEach(function(item) {
                        if (item && item.title) {
                            var newTitle = addEpisodeNumber(item.title);
                            if (newTitle !== item.title) {
                                item.title = newTitle;
                            }
                        }
                    });
                }
            } catch (e) {}
            return origSet.call(this, playlist);
        };
        
        return true;
    }

    // ========= ЗАПУСК =========
    
    function init() {
        var patched1 = patchPlayer();
        var patched2 = patchPlaylist();
        
        if (!patched1 || !patched2) {
            setTimeout(init, 2000);
        } else {
            console.log('✅ Добавление номера серии в название - готово!');
        }
    }

    // Ждем загрузку Lampa
    if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                init();
            }
        });
    }
    
    if (window.Lampa && Lampa.Player) {
        init();
    }
    
    console.log('🔌 Скрипт добавления номера серии загружен!');
})();
