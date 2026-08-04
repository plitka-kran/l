(function () {
    'use strict';

    // --- Настройки и Константы ---
    var SITE_HOST = 'https://uakinogo.is';

    // --- Модуль поиска и парсинга uakinogo ---
    function UaKinogoSource(component, _object) {
        var network = new Lampa.Reguest();
        var object = _object;
        var select_title = '';

        // Функция поиска по сайту uakinogo.is (DLE Search)
        this.search = function (_object, kinopoisk_id, data) {
            var _this = this;
            object = _object;
            select_title = object.search || object.movie.title;

            var clean_title = component.cleanTitle(select_title);
            var searchUrl = SITE_HOST + '/index.php?do=search&subaction=search&story=' + encodeURIComponent(clean_title);

            network.clear();
            network.timeout(10000);
            network.silent(searchUrl, function (str) {
                str = (str || '').replace(/\n/g, '');
                var items = [];
                
                // Парсим результаты выдачи DLE (ссылки на фильмы)
                var matches = str.match(/<a class="full-rest__title" href="([^"]+)">([^<]+)<\/a>/g);
                
                if (matches) {
                    matches.forEach(function(item) {
                        var href = item.match(/href="([^"]+)"/);
                        var title = item.match(/>([^<]+)</);
                        if (href && title) {
                            items.push({
                                title: title[1].trim(),
                                link: href[1]
                            });
                        }
                    });
                }

                if (items.length === 1) {
                    // Если найден 1 фильм — сразу открываем
                    _this.getPage(items[0].link);
                } else if (items.length > 1) {
                    // Если несколько — выводим список на выбор
                    component.similars(items);
                    component.loading(false);
                } else {
                    component.emptyForQuery(select_title);
                }
            }, function (a, c) {
                component.empty(network.errorDecode(a, c));
            }, false, { dataType: 'text' });
        };

        // Извлечение плеера со страницы фильма
        this.getPage = function (url) {
            network.clear();
            network.timeout(10000);
            network.silent(url, function (str) {
                // Ищем iframe балансера (например, Alloha, Collaps, Voidboost или Kodik)
                var iframeMatch = str.match(/<iframe[^>]+src="([^"]+)"/i);

                if (iframeMatch && iframeMatch[1]) {
                    var iframeUrl = iframeMatch[1];
                    if (iframeUrl.indexOf('http') !== 0) {
                        iframeUrl = 'https:' + iframeUrl;
                    }
                    
                    // Формируем элемент для списка плеера Lampa
                    var items = [{
                        title: object.movie.title || select_title,
                        quality: 'HD',
                        info: ' / uakinogo',
                        media: {
                            iframe: iframeUrl
                        }
                    }];

                    component.loading(false);
                    component.appendItems(items);
                } else {
                    component.empty('Плеер не найден на странице');
                }
            }, function (a, c) {
                component.empty(network.errorDecode(a, c));
            }, false, { dataType: 'text' });
        };

        this.destroy = function () {
            network.clear();
        };
    }

    // --- Основной Компонент Lampa ---
    function component(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var files = new Lampa.Explorer(object);
        var source = new UaKinogoSource(this, object);

        scroll.body().addClass('torrent-list');

        this.create = function () {
            files.appendFiles(scroll.render());
            this.search();
            return this.render();
        };

        this.search = function () {
            this.activity.loader(true);
            source.search(object, null);
        };

        this.cleanTitle = function (str) {
            return str.replace(/[\s.,:;’'`!?]+/g, ' ').trim();
        };

        this.appendItems = function (items) {
            var _this = this;
            items.forEach(function (element) {
                var item = $(Lampa.Template.get('online_mod', element));

                item.on('hover:enter', function () {
                    // Запуск плеера / WebView для iframe
                    Lampa.Platform.openIframe ? 
                        Lampa.Platform.openIframe(element.media.iframe) : 
                        Lampa.Player.play({ url: element.media.iframe, title: element.title });
                });

                scroll.append(item);
            });
            this.start(true);
        };

        this.empty = function (msg) {
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            scroll.append(empty);
            this.loading(false);
        };

        this.emptyForQuery = function (query) {
            this.empty('По запросу (' + query + ') ничего не найдено на uakinogo');
        };

        this.loading = function (status) {
            this.activity.loader(status);
        };

        this.start = function () {
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), files.render());
                },
                back: function () { Lampa.Activity.backward(); }
            });
            Lampa.Controller.toggle('content');
        };

        this.render = function () { return files.render(); };
        this.destroy = function () { files.destroy(); scroll.destroy(); source.destroy(); };
    }

    // --- Инициализация плагина ---
    function startPlugin() {
        Lampa.Component.add('uakinogo_mod', component);

        var button = "<div class=\"full-start__button selector view--uakinogo\" data-subtitle=\"\">\n" +
            "<span>Смотреть на UaKinogo</span>\n</div>";

        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var btn = $(button);
                btn.on('hover:enter', function () {
                    Lampa.Activity.push({
                        url: '',
                        title: 'UaKinogo',
                        component: 'uakinogo_mod',
                        search: e.data.movie.title,
                        movie: e.data.movie
                    });
                });
                e.object.activity.render().find('.view--torrent').after(btn);
            }
        });
    }

    if (window.appready) startPlugin();
    else Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') startPlugin(); });
})();
