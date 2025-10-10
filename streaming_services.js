// Расширение для Лампы - Стриминговые сервисы
// Версия: 4.0 - Совместимость со всеми версиями Lampa

(function() {
    'use strict';

    var manifest = {
        type: 'video',
        version: '1.0.0',
        name: 'Стриминговые сервисы',
        description: 'Netflix, HBO, Hulu и другие популярные сервисы',
        component: 'streaming_services'
    };

    // Конфигурация сервисов
    var services = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 },
        hulu: { name: 'Hulu', id: 15 },
        disney: { name: 'Disney+', id: 337 },
        amazon: { name: 'Prime Video', id: 9 },
        apple: { name: 'Apple TV+', id: 350 }
    };

    // Категории
    var categories = [
        { id: 'movies_popular', name: 'Популярные фильмы', type: 'movie', sort: 'popularity.desc' },
        { id: 'movies_new', name: 'Новинки фильмов', type: 'movie', sort: 'primary_release_date.desc', recent: true },
        { id: 'series_popular', name: 'Популярные сериалы', type: 'tv', sort: 'popularity.desc' },
        { id: 'series_new', name: 'Новинки сериалов', type: 'tv', sort: 'first_air_date.desc', recent: true }
    ];

    // Построение URL
    function getUrl(serviceId, cat) {
        var endpoint = cat.type === 'movie' ? 'discover/movie' : 'discover/tv';
        var url = endpoint + '?sort_by=' + cat.sort;
        url += '&with_watch_providers=' + serviceId;
        url += '&watch_region=US';
        url += '&vote_count.gte=20';
        
        if (cat.recent) {
            var d = new Date();
            d.setMonth(d.getMonth() - 6);
            var date = d.toISOString().split('T')[0];
            url += cat.type === 'movie' 
                ? '&primary_release_date.gte=' + date
                : '&first_air_date.gte=' + date;
        }
        
        return url;
    }

    // Показ контента
    function openContent(serviceKey, catIndex) {
        var service = services[serviceKey];
        var cat = categories[catIndex];
        var url = getUrl(service.id, cat);

        Lampa.Activity.push({
            url: url,
            title: service.name + ' - ' + cat.name,
            component: 'category',
            page: 1,
            source: 'tmdb',
            type: cat.type
        });
    }

    // Меню выбора категории
    function showCategories(serviceKey) {
        var service = services[serviceKey];
        var items = [];

        for (var i = 0; i < categories.length; i++) {
            items.push({
                title: categories[i].name,
                index: i,
                service: serviceKey
            });
        }

        Lampa.Select.show({
            title: service.name,
            items: items,
            onSelect: function(item) {
                openContent(item.service, item.index);
            },
            onBack: function() {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    // Компонент каталога
    function component(serviceKey) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var items = [];
        var html = Lampa.Template.get('items_line', { title: services[serviceKey].name });
        var body = html.find('.items-line__body');
        var last;

        this.create = function() {
            var _this = this;
            
            scroll.minus(html.find('.items-line__title'));
            html.find('.items-line__title').text(services[serviceKey].name);
            scroll.append(body);
            
            for (var i = 0; i < categories.length; i++) {
                this.appendCategory(i);
            }

            scroll.append(html);
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.appendCategory = function(index) {
            var cat = categories[index];
            var card = Lampa.Template.get('card', { title: cat.name });
            
            card.addClass('card--category');
            card.find('.card__img').css('background-color', '#353535');
            card.find('.card__title').text(cat.name);
            
            card.on('hover:focus', function() {
                last = card[0];
                scroll.update(card, true);
            });

            card.on('hover:enter', function() {
                openContent(serviceKey, index);
            });

            body.append(card);
            items.push(card);
        };

        this.start = function() {
            Lampa.Controller.add('content', {
                toggle: function() {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(last || false, scroll.render());
                },
                left: function() {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                down: this.down,
                up: this.up,
                back: this.back
            });

            Lampa.Controller.toggle('content');
        };

        this.pause = function() {};
        this.stop = function() {};
        this.render = function() { return html; };
        this.destroy = function() {
            network.clear();
            scroll.destroy();
            html.remove();
            items = null;
            network = null;
        };
    }

    // Инициализация
    function startPlugin() {
        // Добавляем компонент для каждого сервиса
        for (var key in services) {
            (function(serviceKey) {
                Lampa.Component.add('streaming_' + serviceKey, component.bind({}, serviceKey));
            })(key);
        }

        // Добавляем в главное меню через Template
        var menuAdded = false;
        
        Lampa.Listener.follow('full', function(e) {
            if (e.type === 'complite' && !menuAdded) {
                menuAdded = true;
                
                var menuList = document.querySelector('.menu .menu__list');
                if (menuList) {
                    for (var key in services) {
                        (function(serviceKey, serviceName) {
                            var li = document.createElement('li');
                            li.className = 'menu__item selector';
                            li.innerHTML = '<div class="menu__ico"><svg width="512" height="512" viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg></div><div class="menu__text">' + serviceName + '</div>';
                            
                            li.addEventListener('click', function() {
                                showCategories(serviceKey);
                            });
                            
                            Lampa.Listener.follow('hover', function(ev) {
                                if (ev.elem && ev.elem[0] === li && ev.type === 'enter') {
                                    showCategories(serviceKey);
                                }
                            });
                            
                            menuList.appendChild(li);
                        })(key, services[key].name);
                    }
                }
            }
        });

        Lampa.Noty.show('Стриминговые сервисы загружены');
        console.log('[Streaming Services] Плагин активирован');
    }

    // Запуск
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

})();
