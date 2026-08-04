// ============================================================
//  UAkinogo Player Mod - Исправленная версия
//  Версия: 2.1.0
// ============================================================

(function() {
    'use strict';

    // Проверяем, что Lampa загружен
    if (typeof Lampa === 'undefined') {
        console.warn('Lampa не найден, скрипт не будет загружен');
        return;
    }

    // --- Утилиты ---
    function getUrlParams(url) {
        var params = {};
        try {
            var a = document.createElement('a');
            a.href = url;
            var query = a.search.substring(1);
            if (!query) return params;
            var pairs = query.split('&');
            for (var i = 0; i < pairs.length; i++) {
                var pair = pairs[i].split('=');
                if (pair.length === 2) {
                    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                }
            }
        } catch (e) {}
        return params;
    }

    function extractVideoId(url) {
        if (!url) return null;
        
        // YouTube
        var youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/i;
        var match = url.match(youtubeRegex);
        if (match) return match[1];

        // Ortified
        var ortifiedRegex = /embed\/(?:movie|tv)\/(\d+)/;
        match = url.match(ortifiedRegex);
        if (match) return match[1];

        // Stravers
        var straversRegex = /token_movie=([a-f0-9]+)/;
        match = url.match(straversRegex);
        if (match) return match[1];

        return null;
    }

    // --- Компонент плеера ---
    function UakinogoPlayer(object) {
        this.object = object || {};
        this.scroll = null;
        this.files = null;
        this.filter = null;
        this.videoSources = [];
        this.network = new Lampa.Reguest();

        this.create = function() {
            var _this = this;

            // Создаем компоненты
            this.scroll = new Lampa.Scroll({ mask: true, over: true });
            this.files = new Lampa.Explorer(this.object);
            this.filter = new Lampa.Filter(this.object);

            // Настройка интерфейса
            this.scroll.body().addClass('torrent-list');
            
            var head = this.files.render().find('.explorer__files-head');
            if (head.length) {
                this.scroll.minus(head);
            }

            this.filter.render().find('.filter--sort').html('<span>Видео источники</span>');
            this.files.appendHead(this.filter.render());
            this.files.appendFiles(this.scroll.render());

            this.loadVideoSources();
            return this.render();
        };

        this.loadVideoSources = function() {
            var _this = this;
            
            if (this.activity) {
                this.activity.loader(true);
            }

            // Ищем все iframe на странице
            var iframes = document.querySelectorAll('.pmovie__player iframe, .tabs-block__content iframe, .video-inside iframe, .js-player-box iframe');
            
            if (!iframes || iframes.length === 0) {
                this.empty('Видео источники не найдены');
                return;
            }

            var sources = [];
            iframes.forEach(function(iframe, index) {
                var src = iframe.src;
                if (!src) return;

                var source = {
                    url: src,
                    title: 'Источник ' + (index + 1),
                    type: 'iframe',
                    quality: 'FHD',
                    videoId: extractVideoId(src)
                };

                // Определяем тип плеера
                if (src.indexOf('ortified.ws') !== -1) {
                    source.title = 'Плеер Ortified';
                    source.type = 'ortified';
                } else if (src.indexOf('stravers.live') !== -1) {
                    source.title = 'Плеер Stravers';
                    source.type = 'stravers';
                } else if (src.indexOf('youtube.com') !== -1 || src.indexOf('youtu.be') !== -1) {
                    source.title = 'YouTube';
                    source.type = 'youtube';
                    source.quality = '4K';
                } else if (src.indexOf('temptcdn.com') !== -1) {
                    source.title = 'Плеер Tempt';
                    source.type = 'tempt';
                }

                sources.push(source);
            });

            if (sources.length === 0) {
                this.empty('Нет доступных видео источников');
                return;
            }

            this.videoSources = sources;
            this.displaySources();
            
            if (this.activity) {
                this.activity.loader(false);
            }
        };

        this.displaySources = function() {
            var _this = this;
            
            if (!this.scroll) return;
            this.scroll.clear();

            this.videoSources.forEach(function(source, index) {
                // Создаем элемент списка
                var item = $('<div class="online selector">' +
                    '<div class="online__body">' +
                        '<div style="position:absolute;left:0;top:50%;transform:translateY(-50%);width:2.4em;height:2.4em">' +
                            '<svg style="height:2.4em;width:2.4em" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg">' +
                                '<circle cx="64" cy="64" r="56" stroke="white" stroke-width="16"/>' +
                                '<path d="M90.5 64.3827L50 87.7654L50 41L90.5 64.3827Z" fill="white"/>' +
                            '</svg>' +
                        '</div>' +
                        '<div class="online__title" style="padding-left:2.1em">' + source.title + '</div>' +
                        '<div class="online__quality" style="padding-left:3.4em">' + (source.quality || 'FHD') + ' / ' + (source.type || 'iframe') + '</div>' +
                    '</div>' +
                '</div>');

                item.on('hover:enter', function() {
                    _this.playSource(source, index);
                });

                _this.scroll.append(item);
            });

            // Фокусируемся на первом элементе
            var firstItem = this.scroll.render().find('.selector').eq(0);
            if (firstItem.length) {
                this.start(firstItem[0]);
            }
        };

        this.playSource = function(source, index) {
            var _this = this;
            
            // Показываем уведомление о загрузке
            if (Lampa.Noty) {
                Lampa.Noty.show('Загрузка видео...');
            }

            // Для YouTube - простая ссылка
            if (source.type === 'youtube') {
                if (Lampa.Player) {
                    Lampa.Player.play({
                        url: source.url,
                        title: this.object.title || 'Видео'
                    });
                }
                return;
            }

            // Пытаемся получить прямую ссылку
            this.getDirectUrl(source, function(directUrl) {
                if (directUrl && Lampa.Player) {
                    // Проверяем тип ссылки
                    if (directUrl.indexOf('.m3u8') !== -1 || directUrl.indexOf('manifest') !== -1) {
                        Lampa.Player.play({
                            url: directUrl,
                            title: _this.object.title || 'Видео'
                        });
                    } else if (directUrl.indexOf('http') === 0) {
                        Lampa.Player.play({
                            url: directUrl,
                            title: _this.object.title || 'Видео'
                        });
                    } else {
                        _this.openIframe(source.url);
                    }
                } else {
                    _this.openIframe(source.url);
                }
            }, function() {
                _this.openIframe(source.url);
            });
        };

        this.getDirectUrl = function(source, onSuccess, onError) {
            var url = source.url;

            // Ortified
            if (source.type === 'ortified' && source.videoId) {
                var apiUrl = 'https://api.ortified.ws/api/video/' + source.videoId;
                this.network.silent(apiUrl, function(data) {
                    try {
                        var json = typeof data === 'string' ? JSON.parse(data) : data;
                        if (json && json.url) {
                            onSuccess(json.url);
                            return;
                        }
                    } catch (e) {}
                    onError();
                }, function() {
                    onError();
                }, false, {
                    headers: {
                        'Referer': 'https://uakinogo.is/'
                    }
                });
                return;
            }

            // Stravers
            if (source.type === 'stravers') {
                var params = getUrlParams(url);
                if (params.token && params.token_movie) {
                    var streamUrl = 'https://Rarity-as.stravers.live/stream?token=' + params.token + '&token_movie=' + params.token_movie;
                    onSuccess(streamUrl);
                    return;
                }
            }

            onError();
        };

        this.openIframe = function(url) {
            // Открываем в новом окне или встроенном плеере
            if (Lampa.Platform && Lampa.Platform.is('android')) {
                // Для Android - пытаемся открыть в WebView
                if (Lampa.Activity) {
                    Lampa.Activity.push({
                        url: url,
                        title: 'Видео плеер',
                        component: 'webview'
                    });
                }
            } else {
                // Для других платформ - предлагаем открыть в браузере
                if (Lampa.Select) {
                    Lampa.Select.show({
                        title: 'Открыть плеер',
                        items: [
                            { title: 'Открыть в браузере', action: 'browser' },
                            { title: 'Встроенный плеер', action: 'embed' }
                        ],
                        onSelect: function(item) {
                            if (item.action === 'browser') {
                                window.open(url, '_blank');
                            } else if (Lampa.Activity) {
                                Lampa.Activity.push({
                                    url: url,
                                    title: 'Видео плеер',
                                    component: 'webview'
                                });
                            }
                        }
                    });
                } else {
                    window.open(url, '_blank');
                }
            }
        };

        this.empty = function(msg) {
            if (!this.scroll) return;
            
            var empty = $('<div class="empty">' +
                '<div class="empty__icon"></div>' +
                '<div class="empty__descr">' + (msg || 'Ничего не найдено') + '</div>' +
            '</div>');
            
            this.scroll.append(empty);
            
            if (this.activity) {
                this.activity.loader(false);
            }
        };

        this.start = function(first) {
            var _this = this;
            
            if (!this.scroll || !this.files) return;
            
            if (Lampa.Activity && Lampa.Activity.active().activity !== this.activity) return;

            if (Lampa.Background) {
                Lampa.Background.immediately(Lampa.Utils.cardImgBackground(this.object));
            }

            if (Lampa.Controller) {
                Lampa.Controller.add('content', {
                    toggle: function() {
                        Lampa.Controller.collectionSet(_this.scroll.render(), _this.files.render());
                        Lampa.Controller.collectionFocus(first || false, _this.scroll.render());
                    },
                    up: function() { 
                        if (Navigator && Navigator.canmove('up')) {
                            Navigator.move('up');
                        } else if (Lampa.Controller) {
                            Lampa.Controller.toggle('head');
                        }
                    },
                    down: function() { 
                        if (Navigator) Navigator.move('down'); 
                    },
                    right: function() { 
                        if (Navigator && Navigator.canmove('right')) {
                            Navigator.move('right');
                        } else if (this.filter) {
                            this.filter.show(Lampa.Lang.translate('title_filter'), 'filter');
                        }
                    },
                    left: function() { 
                        if (Navigator && Navigator.canmove('left')) {
                            Navigator.move('left');
                        } else if (Lampa.Controller) {
                            Lampa.Controller.toggle('menu');
                        }
                    },
                    back: this.back
                });
                
                if (this.inActivity) {
                    Lampa.Controller.toggle('content');
                }
            }
        };

        this.inActivity = function() {
            var body = $('body');
            return !(body.hasClass('settings--open') || 
                    body.hasClass('menu--open') || 
                    body.hasClass('keyboard-input--visible') || 
                    body.hasClass('selectbox--open') || 
                    body.hasClass('search--open'));
        };

        this.back = function() {
            if (Lampa.Activity) {
                Lampa.Activity.backward();
            }
        };

        this.render = function() {
            return this.files ? this.files.render() : $('<div></div>');
        };

        this.destroy = function() {
            if (this.scroll) {
                this.scroll.destroy();
            }
            if (this.files) {
                this.files.destroy();
            }
            if (this.network) {
                this.network.clear();
            }
        };
    }

    // --- Регистрация компонента ---
    try {
        Lampa.Component.add('uakinogo_player', UakinogoPlayer);
        console.log('UAkinogo Player успешно зарегистрирован');
    } catch (e) {
        console.error('Ошибка регистрации компонента:', e);
        return;
    }

    // --- Добавление кнопки ---
    function addButton() {
        // Проверяем, что мы на странице фильма
        if (!document.querySelector('.pmovie')) return;
        if (document.querySelector('.view--uakinogo_player')) return;

        var buttonHtml = 
            '<div class="full-start__button selector view--uakinogo_player">' +
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 260" width="512" height="512" style="width:24px;height:24px">' +
                    '<path d="M242,88v170H10V88h41l-38,38h37.1l38-38h38.4l-38,38h38.4l38-38h38.3l-38,38H204L242,88L242,88z M228.9,2l8,37.7l0,0 L191.2,10L228.9,2z M160.6,56l-45.8-29.7l38-8.1l45.8,29.7L160.6,56z M84.5,72.1L38.8,42.4l38-8.1l45.8,29.7L84.5,72.1z M10,88 L2,50.2L47.8,80L10,88z" fill="currentColor"/>' +
                '</svg>' +
                '<span>Смотреть через плеер</span>' +
            '</div>';

        var button = $(buttonHtml);
        button.on('hover:enter', function() {
            var title = document.querySelector('h1') ? document.querySelector('h1').innerText.trim() : 'Фильм';
            var poster = document.querySelector('.pmovie__poster img') ? document.querySelector('.pmovie__poster img').src : '';
            
            if (Lampa.Activity) {
                Lampa.Activity.push({
                    url: '',
                    title: title,
                    component: 'uakinogo_player',
                    poster: poster,
                    movie: {
                        title: title,
                        poster: poster,
                        id: window.location.pathname.match(/\/(\d+)-/)?.[1] || Date.now()
                    }
                });
            }
        });

        // Вставляем кнопку
        var container = document.querySelector('.full-start__buttons');
        if (container) {
            container.appendChild(button[0]);
        } else {
            // Если контейнера нет, ищем место для вставки
            var torrentBtn = document.querySelector('.view--torrent');
            if (torrentBtn && torrentBtn.parentNode) {
                torrentBtn.parentNode.appendChild(button[0]);
            }
        }
    }

    // --- Запуск ---
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', addButton);
    } else {
        setTimeout(addButton, 500);
    }

    // Наблюдатель за изменениями DOM
    var observer = new MutationObserver(function() {
        addButton();
    });
    
    try {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true,
            attributes: false
        });
    } catch (e) {
        console.warn('Не удалось запустить наблюдатель DOM');
    }

    // Также подписываемся на событие Lampa
    if (Lampa.Listener) {
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                setTimeout(addButton, 100);
            }
        });
    }

    console.log('UAkinogo Player Mod успешно загружен');

})();
