// ============================================================
//  UAkinogo Player Mod (uakinogo.is)
//  Версия: 1.0.0
//  Описание: Расширение для проигрывания видео с uakinogo.is
//  в плеере Lampa, без использования дополнительных прокси.
// ============================================================

(function (Lampa) {
    'use strict';

    // --- Базовые утилиты ---
    function startsWith(str, searchString) {
        return str.indexOf(searchString) === 0;
    }

    function endsWith(str, searchString) {
        var start = str.length - searchString.length;
        if (start < 0) return false;
        return str.indexOf(searchString, start) === start;
    }

    function getDomainFromUrl(url) {
        try {
            var a = document.createElement('a');
            a.href = url;
            return a.hostname;
        } catch (e) {
            return '';
        }
    }

    // Получение данных с текущей страницы
    function getPageData() {
        // Название фильма/сериала
        var title = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : '';

        // Постер
        var poster = document.querySelector('.pmovie__poster img') ? document.querySelector('.pmovie__poster img').src : '';

        // ID (берем из URL страницы)
        var pageId = window.location.pathname.match(/\/(\d+)-/);
        pageId = pageId ? pageId[1] : '';

        // --- Парсинг ссылок на видео ---
        var videoLinks = [];
        var players = document.querySelectorAll('.pmovie__player .tabs-block__content iframe, .pmovie__player .tabs-block__content .video-content iframe');

        players.forEach(function(iframe) {
            var src = iframe.src;
            if (src) {
                // Сохраняем оригинальную ссылку и пытаемся получить прямую ссылку на видео
                videoLinks.push({
                    original: src,
                    type: 'iframe',
                    // Пытаемся найти реальный URL видео, если iframe с другого сайта
                    // В идеале, здесь должен быть код, который парсит ответ от этих iframe,
                    // но из-за CORS это невозможно в чистом виде.
                    // Поэтому мы будем использовать прокси для получения ссылки.
                    url: null // Будет заполнено позже через прокси
                });
            }
        });

        return {
            title: title,
            poster: poster,
            pageId: pageId,
            videoLinks: videoLinks
        };
    }

    // --- Компонент "UAkinogo Player" ---
    function UakinogoPlayer(object) {
        this.object = object;
        this.scroll = new Lampa.Scroll({ mask: true, over: true });
        this.files = new Lampa.Explorer(object);
        this.filter = new Lampa.Filter(object);
        this.videoItems = [];
        this.selectedItem = null;

        this.create = function () {
            var _this = this;

            // Настраиваем интерфейс
            this.scroll.body().addClass('torrent-list');
            this.scroll.minus(this.files.render().find('.explorer__files-head'));

            // Кнопки управления
            this.filter.render().find('.filter--sort').html('<span>Источники</span>');
            this.files.appendHead(this.filter.render());
            this.files.appendFiles(this.scroll.render());

            // Загружаем данные
            this.loadVideos();

            return this.render();
        };

        this.loadVideos = function () {
            var _this = this;
            this.activity.loader(true);

            // Извлекаем данные со страницы
            var pageData = getPageData();

            if (!pageData.videoLinks || pageData.videoLinks.length === 0) {
                this.empty('Видео не найдено на этой странице.');
                return;
            }

            // Создаем элементы для каждого источника
            pageData.videoLinks.forEach(function(link, index) {
                var label = 'Источник ' + (index + 1);
                // Пытаемся определить название плеера
                if (link.original.indexOf('api.ortified.ws') !== -1) label = 'Плеер 1 (Ortified)';
                else if (link.original.indexOf('stravers.live') !== -1) label = 'Плеер 2 (Stravers)';
                else if (link.original.indexOf('youtube.com') !== -1) label = 'Трейлер (YouTube)';
                else if (link.original.indexOf('temptcdn.com') !== -1) label = 'Плеер 3 (Tempt)';
                else label = 'Плеер ' + (index + 1);

                var item = {
                    title: label,
                    quality: 'FHD (1080p)',
                    info: ' / uakinogo.is',
                    originalLink: link.original,
                    // Создаем прокси-ссылку для получения видео
                    proxyUrl: _this.proxyLink(link.original)
                };
                _this.videoItems.push(item);
            });

            // Отображаем список
            this.displayItems();
            this.activity.loader(false);
        };

        // Метод для проксирования ссылки (без реального прокси, просто возвращаем исходную)
        this.proxyLink = function (url) {
            // Здесь можно было бы реализовать прокси, но для прямого доступа возвращаем URL как есть.
            // В реальности, если iframe с другого сайта, нам нужен прокси для получения прямого видео.
            // В рамках этого примера мы будем просто открывать iframe через плеер.
            return url;
        };

        this.displayItems = function () {
            var _this = this;
            this.scroll.clear();

            this.videoItems.forEach(function(item, index) {
                var element = $(Lampa.Template.get('online_mod', item)); // Используем шаблон из оригинального мода
                // Адаптируем стили
                element.addClass('selector');

                element.on('hover:enter', function () {
                    _this.selectedItem = item;
                    // Пытаемся извлечь реальное видео через прокси
                    _this.getStream(item, function (stream) {
                        // Воспроизводим
                        var playData = {
                            url: stream,
                            title: _this.object.title || _this.videoItems[0].title
                        };
                        // Пытаемся получить качество, если это прямой поток
                        if (stream && stream.indexOf('.m3u8') !== -1) {
                            Lampa.Player.play(playData);
                        } else if (stream && stream.indexOf('iframe') === -1) {
                            // Если это прямая ссылка на видео (не iframe)
                            Lampa.Player.play({
                                url: stream,
                                title: _this.object.title || _this.videoItems[0].title,
                                quality: { '1080p': stream } // Условно
                            });
                        } else {
                            // Если это iframe, просто открываем его в плеере (не всегда работает)
                            // В идеале нужно извлечь ссылку на видео из iframe.
                            Lampa.Noty.show('Попробуйте открыть в браузере: ' + stream);
                            // Альтернатива: открыть встроенным браузером Lampa
                            Lampa.Activity.push({
                                url: stream,
                                title: 'Видео'
                            });
                        }
                    }, function (error) {
                        Lampa.Noty.show('Не удалось загрузить видео: ' + (error || 'неизвестная ошибка'));
                    });
                });

                _this.scroll.append(element);
            });

            // Фокусируемся на первом элементе
            if (this.scroll.render().find('.selector').length) {
                var first = this.scroll.render().find('.selector').eq(0)[0];
                this.start(first);
            }
        };

        this.getStream = function (item, onSuccess, onError) {
            // Вместо реального прокси, мы пытаемся загрузить страницу iframe и извлечь видео
            // Из-за CORS это не всегда возможно, поэтому используем упрощенный подход.
            // Пробуем получить iframe и извлечь из него src
            var url = item.originalLink;
            // Если это iframe, пытаемся загрузить его содержимое через прокси (не работает без серверной части)
            // Поэтому мы просто возвращаем оригинальный URL, и плеер Lampa попытается его открыть.
            // Это может не сработать для защищенных источников, но работает для открытых.
            if (url.indexOf('youtube.com/embed') !== -1) {
                // Для YouTube можно напрямую использовать ссылку
                onSuccess(url);
                return;
            }

            // Для других случаев — просто возвращаем ссылку на iframe
            // Пользователь может открыть ее в браузере
            onSuccess(url);
        };

        this.empty = function (msg) {
            var empty = Lampa.Template.get('list_empty');
            if (msg) empty.find('.empty__descr').text(msg);
            this.scroll.append(empty);
            this.activity.loader(false);
        };

        this.start = function (first) {
            if (Lampa.Activity.active().activity !== this.activity) return;

            Lampa.Background.immediately(Lampa.Utils.cardImgBackground(this.object));
            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(_this.scroll.render(), _this.files.render());
                    Lampa.Controller.collectionFocus(first || false, _this.scroll.render());
                },
                up: function () {
                    Navigator.move('up');
                },
                down: function () {
                    Navigator.move('down');
                },
                right: function () {
                    Navigator.move('right');
                },
                left: function () {
                    Navigator.move('left');
                },
                back: this.back
            });
            Lampa.Controller.toggle('content');
        };

        this.back = function () {
            Lampa.Activity.backward();
        };

        this.render = function () {
            return this.files.render();
        };

        this.destroy = function () {
            this.scroll.destroy();
            this.files.destroy();
        };
    }

    // --- Инициализация ---

    // Добавляем шаблон для отображения источников
    Lampa.Template.add('uakinogo_player_item', '<div class="online selector"><div class="online__body"><div style="position: absolute;left: 0;top: 50%;transform: translateY(-50%);width: 2.4em;height: 2.4em"><svg style="height: 2.4em; width: 2.4em;" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/><path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/></svg></div><div class="online__title" style="padding-left: 2.1em;">{title}</div><div class="online__quality" style="padding-left: 3.4em;">{quality}{info}</div></div></div>');

    // Переопределяем шаблон, если используется online_mod
    if (Lampa.Template.get('online_mod')) {
        // Если шаблон уже существует, используем его
    } else {
        Lampa.Template.add('online_mod', Lampa.Template.get('uakinogo_player_item'));
    }

    // Регистрируем компонент
    Lampa.Component.add('uakinogo_player', UakinogoPlayer);

    // Добавляем кнопку на страницу фильма
    function addWatchButton() {
        // Проверяем, что мы на странице фильма
        var isMoviePage = document.querySelector('.pmovie') !== null;
        if (!isMoviePage) return;

        // Проверяем, есть ли уже кнопка
        if (document.querySelector('.view--uakinogo_player')) return;

        // Создаем кнопку
        var buttonHtml = '<div class="full-start__button selector view--uakinogo_player" data-subtitle="Смотреть в плеере">\
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 260" style="enable-background:new 0 0 512 512" width="512" height="512">\
                <path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z" fill="currentColor"/>\
            </svg>\
            <span>Смотреть на Uakinogo</span>\
        </div>';

        var button = $(buttonHtml);
        button.on('hover:enter', function () {
            var title = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : 'Фильм';
            var poster = document.querySelector('.pmovie__poster img') ? document.querySelector('.pmovie__poster img').src : '';

            // Запускаем наш плеер
            Lampa.Activity.push({
                url: '',
                title: title,
                component: 'uakinogo_player',
                poster: poster,
                movie: {
                    title: title,
                    poster: poster
                }
            });
        });

        // Добавляем кнопку рядом с торрент-кнопкой
        Lampa.Listener.follow('full', function (e) {
            if (e.type == 'complite') {
                var container = e.object.activity.render().find('.view--torrent').parent();
                if (container.length && !container.find('.view--uakinogo_player').length) {
                    container.append(button);
                }
            }
        });
    }

    // Запускаем при загрузке страницы
    document.addEventListener('DOMContentLoaded', function () {
        addWatchButton();
    });

    // Повторная проверка после изменения DOM (для динамических страниц)
    var observer = new MutationObserver(function () {
        addWatchButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });

})(window.Lampa || window);
