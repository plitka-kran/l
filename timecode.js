(function () {
    'use strict';

    function initAutoSkipPlugin() {
        // Слушаем события встроенного плеера Lampa
        Lampa.Listener.follow('player', function (e) {
            
            // Когда видео готово к воспроизведению или обновились метаданные
            if (e.type === 'ready' || e.type === 'metadata' || e.type === 'play') {
                var videoElement = e.player?.video;
                
                if (videoElement) {
                    var introSkipped = false;

                    // Каждую секунду следим за таймлайном видео
                    videoElement.ontimeupdate = function () {
                        var currentTime = videoElement.currentTime;
                        
                        // Защита: ищем начальные титры только в первые 8 минут серии (480 секунд)
                        // Это исключает ложные срабатывания в конце или середине фильма
                        if (currentTime < 480 && !introSkipped) {
                            
                            // Проверяем, передал ли балансер (Резка/Ashdi) метки заставки (intro)
                            if (e.player.data && e.player.data.intro) {
                                var introStart = e.player.data.intro.start;
                                var introEnd = e.player.data.intro.end;

                                // Если текущее время попало в диапазон начальных титров
                                if (currentTime >= introStart && currentTime < introEnd) {
                                    introSkipped = true;
                                    
                                    // Мгновенно перематываем на конец заставки
                                    videoElement.currentTime = introEnd;

                                    // Показываем аккуратное уведомление вверху по центру
                                    showTopNotification();
                                    
                                    // Отключаем слушатель для этой серии, так как начальные титры уже пропущены
                                    videoElement.ontimeupdate = null; 
                                }
                            }
                        }
                    };
                }
            }
        });
    }

    // Функция отрисовки красивого уведомления вверху по центру экрана
    function showTopNotification() {
        // Удаляем старое уведомление, если оно почему-то осталось
        $('#lampa-auto-skip-notice').remove();

        // Создаем плашку с текстом на UA и RU
        var notice = $(
            '<div id="lampa-auto-skip-notice" style="' +
            'position: fixed; ' +
            'top: 20px; ' +
            'left: 50%; ' +
            'transform: translateX(-50%); ' +
            'background: rgba(0, 0, 0, 0.85); ' +
            'color: #fff; ' +
            'padding: 10px 25px; ' +
            'border-radius: 8px; ' +
            'border: 1px solid #ff5c00; ' +
            'font-family: sans-serif; ' +
            'font-size: 16px; ' +
            'text-align: center; ' +
            'z-index: 99999; ' +
            'pointer-events: none; ' +
            'box-shadow: 0 4px 15px rgba(0,0,0,0.5);' +
            '">' +
            '<div style="font-weight: bold; color: #ff5c00; margin-bottom: 2px;">Початкові титри пропущені</div>' +
            '<div style="font-size: 13px; opacity: 0.8;">Начальные титры пропущены</div>' +
            '</div>'
        );

        // Добавляем на экран
        $('body').append(notice);

        // Плавно скрываем и удаляем через 3 секунды
        notice.delay(3000).fadeOut(500, function() {
            $(this).remove();
        });
    }

    // Регистрация плагина в Lampa
    if (window.Lampa) {
        initAutoSkipPlugin();
    } else {
        var readyTimer = setInterval(function () {
            if (window.Lampa) {
                clearInterval(readyTimer);
                initAutoSkipPlugin();
            }
        }, 100);
    }
})();
