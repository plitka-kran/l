(function () {
    'use strict';

    Lampa.Platform.tv();

    // ------------------------------------------------------------
    // 1. Настройки Lampa
    // ------------------------------------------------------------
    window.lampa_settings = window.lampa_settings || {};

    var s = window.lampa_settings;
    s.socket_use     = false;
    s.socket_url     = undefined;
    s.socket_methods = false;
    s.account_use    = true;
    s.account_sync   = true;
    s.plugins_use    = true;
    s.plugins_store  = true;
    s.torrents_use   = true;
    s.white_use      = false;
    s.lang_use       = true;
    s.read_only      = false;
    s.dcma           = false;
    s.push_state     = true;
    s.iptv           = false;
    s.feed           = false;
    s.geo            = false;
    s.mirrors        = true;

    s.disable_features = s.disable_features || {};
    var f = s.disable_features;
    f.dmca          = true;
    f.reactions     = true;
    f.discuss       = true;
    f.ai            = true;
    f.subscribe     = true;
    f.blacklist     = true;
    f.persons       = true;
    f.ads           = true;
    f.trailers      = false;
    f.install_proxy = true;

    s.developer = s.developer || {};
    s.developer.ads       = false;
    s.developer.enabled   = false;
    s.developer.fps       = false;
    s.developer.nodemo    = false;
    s.developer.nopremium = false;

    // ------------------------------------------------------------
    // 2. Удаление рекламы на карточке и в онлайн-плагине
    // ------------------------------------------------------------
    function removeAdsOnSelect() {
        Lampa.Controller.listener.follow('toggle', function (e) {
            if (e.name !== 'select') return;

            setTimeout(function () {
                var component = Lampa.Activity.active().component;

                if (component === 'full' && document.querySelector('.ad-server') !== null) {
                    $('.ad-server').remove();
                }

                if (component === 'modss_online') {
                    $('.selectbox-item--icon').remove();
                }
            }, 20);
        });
    }

    // ------------------------------------------------------------
    // 3. Скрытие кнопок и пунктов интерфейса
    // ------------------------------------------------------------
    function cleanInterface() {
        // Только для официальной сборки
        if (Lampa.Manifest.origin !== 'bylampa') {
            Lampa.Noty.show('Ошибка доступа');
            return;
        }

        // CSS: прячем акционные кнопки, подписку, уведомления, мигающую иконку
        var style = document.createElement('style');
        style.innerHTML =
            '.button--subscribe { display: none; }' +
            '.black-friday__button { display: none; }' +
            '.icon--blink { display: none; }' +
            '.womens_day__button { display: none; }' +
            '.christmas__button { display: none; }' +
            '.notice--icon { display: none; }';
        document.body.appendChild(style);

        // Кнопка трансляции
        setTimeout(function () {
            if ($('.open--broadcast').length > 0) $('.open--broadcast').remove();
        }, 1000);

        // Настройки: при открытии разделов убираем лишнее
        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'server') {
                if (document.querySelector('.ad-server') !== null) $('.ad-server').remove();
            }

            if (e.name === 'more') {
                e.body.find('[data-name="card_quality"]').remove();
                e.body.find('[data-name="export"]').remove();
                $('div > span:contains("Консоль")').parent().remove();
                e.body.find('[data-name="terminal"]').remove();
            }

            if (e.name === 'interface') {
                e.body.find('[data-name="card_interfice_reactions"]').remove();
            }
        });

        // Карточка фильма: убираем кнопку «Опции»
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                $('.button--book').on('hover:enter', function () {});

                setTimeout(function () {
                    $('.button--options').remove();
                }, 0);
            }
        });
    }

    // ------------------------------------------------------------
    // 4. Запуск
    // ------------------------------------------------------------
    function removeMenuItems() {
        // Календарь/расписание
        $('[data-action=timetable]').eq(0).remove();

        // Пункт «Спорт» в главном меню
        setTimeout(function () {
            $('#app > div.wrap.layer--height.layer--width > div.wrap__left.layer--height > div > div > div > div > div:nth-child(1) > ul > li:contains("Спорт")').remove();
        }, 1000);
    }

    function start() {
        cleanInterface();
        removeAdsOnSelect();
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                start();
                removeMenuItems();
            }
        });
    }
})();
