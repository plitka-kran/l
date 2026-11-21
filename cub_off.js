(function () {
    'use strict';

    // Убирает только рекламу перед видео. Интерфейс не трогает.
    //
    // Lampa пропускает преролл, если у данных запуска стоит iptv.
    // Ставим iptv=true перед запуском плеера и возвращаем исходное
    // состояние, как только плеер стартует (чтобы работали прогресс
    // просмотра и панель плеера).
    //
    // Если что-то работает странно, поставьте HARD_MODE = false.
    var HARD_MODE = true;

    function restore(data) {
        if (data && data.__noads_tmp_iptv) {
            delete data.iptv;
            delete data.__noads_tmp_iptv;
        }
    }

    function prepare(data) {
        if (!data || typeof data !== 'object') return;

        // реклама, которую передают плагины-источники
        delete data.vast_url;
        delete data.vast_banner;
        delete data.vast;

        if (HARD_MODE && !data.iptv) {
            data.iptv = true;
            data.__noads_tmp_iptv = true;
            setTimeout(function () { restore(data); }, 60000); // страховка
        }
    }

    function patch() {
        try {
            if (!window.Lampa || !Lampa.Player || Lampa.Player.__noads) return;

            var play = Lampa.Player.play;
            if (typeof play !== 'function') return;

            Lampa.Player.play = function (data) {
                prepare(data);
                return play.apply(this, arguments);
            };

            Lampa.Player.listener.follow('start', restore);
            Lampa.Player.listener.follow('external', restore);

            Lampa.Player.__noads = true;
        } catch (e) {}
    }

    if (window.appready) {
        patch();
    } else {
        patch();
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') patch();
        });
    }
})();
