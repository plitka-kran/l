(function () {
    'use strict';

    var API_URL = 'http://185.87.48.42:8095/random_sisi';
    var TIMEOUT = 10000;

    function notify(text) {
        if (window.Lampa && Lampa.Noty) Lampa.Noty.show(text);
    }

    function isValidUrl(str) {
        return /^https?:\/\/[^\s]+$/i.test(str);
    }

    function loadScript() {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', API_URL, true);
        xhr.timeout = TIMEOUT;

        xhr.onreadystatechange = function () {
            if (xhr.readyState !== 4) return;

            if (xhr.status !== 200) {
                console.warn('Ошибка API: HTTP ' + xhr.status);
                notify('Не удалось получить адрес сервера');
                return;
            }

            var scriptUrl = (xhr.responseText || '').trim();

            if (!scriptUrl) {
                console.warn('Пустой ответ от API');
                notify('Не удалось получить адрес сервера');
                return;
            }

            if (!isValidUrl(scriptUrl)) {
                console.warn('Некорректный URL в ответе API: ' + scriptUrl);
                notify('Не удалось получить адрес сервера');
                return;
            }

            Lampa.Utils.putScriptAsync([scriptUrl], function () {});
        };

        xhr.onerror = function () {
            console.warn('Ошибка соединения с API');
            notify('Ошибка доступа');
        };

        xhr.ontimeout = function () {
            console.warn('Таймаут запроса к API');
            notify('Ошибка доступа');
        };

        xhr.send();
    }

    function start() {
        Lampa.Platform.tv(); // принудительный TV-режим, как в оригинале
        loadScript();
    }

    if (window.appready) {
        start();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') start();
        });
    }
})();
