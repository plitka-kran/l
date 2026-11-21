(function () {
    'use strict';

    // ============================================================
    // 1. БЛОКИРОВКА РЕКЛАМЫ НА УРОВНЕ СЕТИ
    //    Lampa 3.x запрашивает рекламу через /api/ad/get/...
    //    Подменяем ответ на пустой {"ad":[]}.
    //    Ставим хуки сразу, не дожидаясь appready.
    // ============================================================
    var AD_URL_RE = /\/api\/ad\/get/i;
    var EMPTY_AD = '{"ad":[]}';

    function isAdUrl(url) {
        try { return AD_URL_RE.test(String(url)); } catch (e) { return false; }
    }

    // --- XMLHttpRequest ---
    try {
        var xhrOpen = XMLHttpRequest.prototype.open;
        var xhrSend = XMLHttpRequest.prototype.send;

        XMLHttpRequest.prototype.open = function (method, url) {
            this.__noads = isAdUrl(url);
            return xhrOpen.apply(this, arguments);
        };

        XMLHttpRequest.prototype.send = function () {
            if (!this.__noads) return xhrSend.apply(this, arguments);

            var xhr = this;

            function define(name, value) {
                try {
                    Object.defineProperty(xhr, name, { value: value, configurable: true });
                } catch (e) {}
            }

            function fire(type) {
                var ev;
                try {
                    ev = new Event(type);
                } catch (e) {
                    ev = document.createEvent('Event');
                    ev.initEvent(type, false, false);
                }
                try { xhr.dispatchEvent(ev); } catch (e) {}
            }

            setTimeout(function () {
                define('readyState', 4);
                define('status', 200);
                define('statusText', 'OK');
                define('responseText', EMPTY_AD);
                define('response', xhr.responseType === 'json' ? { ad: [] } : EMPTY_AD);
                define('responseURL', '');

                fire('readystatechange');
                fire('load');
                fire('loadend');
            }, 0);
        };
    } catch (e) {}

    // --- fetch ---
    try {
        if (window.fetch) {
            var origFetch = window.fetch;

            window.fetch = function (input) {
                var url = typeof input === 'string' ? input : (input && input.url);

                if (isAdUrl(url) && window.Response) {
                    return Promise.resolve(new Response(EMPTY_AD, {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }));
                }

                return origFetch.apply(this, arguments);
            };
        }
    } catch (e) {}

    // ============================================================
    // 2. НАСТРОЙКИ LAMPA
    // ============================================================
    window.lampa_settings = window.lampa_settings || {};

    var s = window.lampa_settings;
    s.account_use    = true;
    s.account_sync   = true;
    s.plugins_use    = true;
    s.plugins_store  = true;
    s.torrents_use   = true;
    s.lang_use       = true;
    s.read_only      = false;
    s.dcma           = false;
    s.push_state     = true;
    s.iptv           = false;
    s.feed           = false;
    s.geo            = false;
    s.mirrors        = true;

    s.disable_features = s.disable_features || {};
    s.disable_features.dmca      = true;
    s.disable_features.reactions = true;
    s.disable_features.discuss   = true;
    s.disable_features.ai        = true;
    s.disable_features.subscribe = true;
    s.disable_features.blacklist = true;
    s.disable_features.persons   = true;
    s.disable_features.ads       = true;

    s.developer = s.developer || {};
    s.developer.ads = false;

    // ============================================================
    // 3. ЧИСТКА VAST-ПОЛЕЙ ПЕРЕД ЗАПУСКОМ ПЛЕЕРА
    //    Реклама перед видео может прийти в данных запуска
    //    (vast_url / vast_banner), а не из /api/ad/get.
    // ============================================================
    function sanitizePlayData(data) {
        if (data && typeof data === 'object') {
            delete data.vast_url;
            delete data.vast_banner;
            delete data.vast;
        }
        return data;
    }

    function patchPlayer() {
        try {
            if (!window.Lampa || !Lampa.Player || Lampa.Player.__noads) return;

            ['play', 'playlist'].forEach(function (method) {
                var original = Lampa.Player[method];
                if (typeof original !== 'function') return;

                Lampa.Player[method] = function (data) {
                    if (method === 'playlist' && Array.isArray(data)) {
                        data.forEach(sanitizePlayData);
                    } else {
                        sanitizePlayData(data);
                    }
                    return original.apply(this, arguments);
                };
            });

            Lampa.Player.__noads = true;
        } catch (e) {}
    }

    // ============================================================
    // 4. ЧИСТКА ИНТЕРФЕЙСА
    // ============================================================
    function removeAdElements() {
        $('.ad-server').remove();
    }

    function cleanInterface() {
        var style = document.createElement('style');
        style.innerHTML =
            '.button--subscribe, .black-friday__button, .icon--blink,' +
            '.womens_day__button, .christmas__button, .notice--icon,' +
            '.ad-server { display: none !important; }';
        document.body.appendChild(style);

        // Следим за DOM: если рекламный блок всё же появился - удаляем
        try {
            var observer = new MutationObserver(function () {
                if (document.querySelector('.ad-server')) removeAdElements();
            });
            observer.observe(document.body, { childList: true, subtree: true });
        } catch (e) {}

        Lampa.Controller.listener.follow('toggle', function (e) {
            if (e.name !== 'select') return;

            setTimeout(function () {
                var component = Lampa.Activity.active().component;

                if (component === 'full') removeAdElements();
                if (component === 'modss_online') $('.selectbox-item--icon').remove();
            }, 20);
        });

        Lampa.Settings.listener.follow('open', function (e) {
            if (e.name === 'server') removeAdElements();

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

        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                setTimeout(function () {
                    $('.button--options').remove();
                    removeAdElements();
                }, 0);
            }
        });

        // Меню: расписание и «Спорт»
        $('[data-action=timetable]').eq(0).remove();
        setTimeout(function () {
            $('li:contains("Спорт")').filter(function () {
                return $(this).text().trim() === 'Спорт';
            }).remove();
            $('.open--broadcast').remove();
        }, 1000);
    }

    // ============================================================
    // 5. ЗАПУСК
    // ============================================================
    patchPlayer();

    function start() {
        patchPlayer();
        cleanInterface();
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
