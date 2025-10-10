// Расширение для Лампы - Стриминговые сервисы
// Добавляет категории в левое меню
// Версия: 3.0

(function() {
    'use strict';

    var Plugin = {
        name: 'Стриминговые сервисы',
        version: '3.0'
    };

    // Конфигурация стриминговых сервисов
    var STREAMING_SERVICES = {
        netflix: {
            name: 'Netflix',
            id: 8,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#E50914"><path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.994 2.344.056 4.85.398 7.254.4-3.462-9.547-5.923-16.219-9.15-24.4H5.398z"/></svg>'
        },
        hbo: {
            name: 'HBO Max',
            id: 384,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#9c27b0"><circle cx="12" cy="12" r="10"/></svg>'
        },
        hulu: {
            name: 'Hulu',
            id: 15,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#3DBB3D"><rect width="24" height="24" rx="4"/></svg>'
        },
        disney: {
            name: 'Disney+',
            id: 337,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#113CCF"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        },
        amazon: {
            name: 'Prime Video',
            id: 9,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#00A8E1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>'
        },
        apple: {
            name: 'Apple TV+',
            id: 350,
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#555"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09z"/></svg>'
        }
    };

    // Категории контента
    var CATEGORIES = {
        movies_popular: { 
            name: 'Популярные фильмы', 
            type: 'movie', 
            sort: 'popularity.desc'
        },
        movies_new: { 
            name: 'Новинки фильмов', 
            type: 'movie', 
            sort: 'primary_release_date.desc',
            date_filter: true
        },
        series_popular: { 
            name: 'Популярные сериалы', 
            type: 'tv', 
            sort: 'popularity.desc'
        },
        series_new: { 
            name: 'Новинки сериалов', 
            type: 'tv', 
            sort: 'first_air_date.desc',
            date_filter: true
        }
    };

    // Функция для создания URL запроса
    function buildUrl(serviceId, category) {
        var type = category.type;
        var endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';
        
        var params = {
            sort_by: category.sort,
            with_watch_providers: serviceId,
            watch_region: 'US',
            'vote_count.gte': 20
        };

        // Добавляем фильтр по дате для новинок
        if (category.date_filter) {
            var today = new Date();
            var sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
            var dateStr = sixMonthsAgo.toISOString().split('T')[0];
            
            if (type === 'movie') {
                params['primary_release_date.gte'] = dateStr;
            } else {
                params['first_air_date.gte'] = dateStr;
            }
        }

        return Lampa.TMDB.api(endpoint, params);
    }

    // Показ контента
    function showContent(serviceKey, categoryKey) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryKey];
        
        var url = buildUrl(service.id, category);

        Lampa.Activity.push({
            url: url,
            title: service.name + ' - ' + category.name,
            component: 'category',
            category: true,
            source: 'tmdb',
            type: category.type,
            page: 1
        });
    }

    // Показ меню категорий для сервиса
    function showServiceMenu(serviceKey) {
        var service = STREAMING_SERVICES[serviceKey];
        var items = [];

        for (var catKey in CATEGORIES) {
            items.push({
                title: CATEGORIES[catKey].name,
                subtitle: '',
                service: serviceKey,
                category: catKey
            });
        }

        Lampa.Select.show({
            title: service.name,
            items: items,
            onSelect: function(a) {
                showContent(a.service, a.category);
            },
            onBack: function() {
                Lampa.Controller.toggle('menu');
            }
        });
    }

    // Добавление пункта в меню
    function addMenuItem(serviceKey, serviceData) {
        var item = $('<li class="menu__item selector" data-action="streaming_' + serviceKey + '">' +
            '<div class="menu__ico">' + serviceData.icon + '</div>' +
            '<div class="menu__text">' + serviceData.name + '</div>' +
        '</li>');

        item.on('hover:enter', function() {
            showServiceMenu(serviceKey);
        });

        $('.menu .menu__list').eq(0).append(item);
    }

    // Инициализация
    function init() {
        // Добавляем пункты меню после загрузки интерфейса
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'complite') {
                setTimeout(function() {
                    for (var key in STREAMING_SERVICES) {
                        addMenuItem(key, STREAMING_SERVICES[key]);
                    }
                }, 100);
            }
        });

        console.log('[Plugin] ' + Plugin.name + ' v' + Plugin.version + ' загружен');
        Lampa.Noty.show('Расширение "' + Plugin.name + '" активировано');
    }

    // Старт плагина
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type == 'ready') {
                init();
            }
        });
    }

})();
