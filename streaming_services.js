(function() {
    'use strict';

    var Plugin = {
        name: 'Стриминговые сервисы',
        version: '1.0'
    };

    // Конфигурация сервисов
    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 },
        hulu: { name: 'Hulu', id: 15 },
        disney: { name: 'Disney+', id: 337 }
    };

    // Категории контента
    var CATEGORIES = {
        movies_popular: { name: 'Популярные фильмы', type: 'movie', sort: 'popularity.desc' },
        movies_new: { name: 'Новинки фильмов', type: 'movie', sort: 'primary_release_date.desc', date_filter: true },
        series_popular: { name: 'Популярные сериалы', type: 'tv', sort: 'popularity.desc' },
        series_new: { name: 'Новинки сериалов', type: 'tv', sort: 'first_air_date.desc', date_filter: true }
    };

    // Формирование URL TMDb через встроенный API
    function buildUrl(serviceId, category) {
        var type = category.type;
        var endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';

        var params = {
            sort_by: category.sort,
            with_watch_providers: serviceId,
            watch_region: 'US',
            'vote_count.gte': 20
        };

        // Фильтр по дате для новинок
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

    // Отображение контента в виде сетки
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

    // Показ меню фильтров для выбранного сервиса
    function showServiceMenu(serviceKey) {
        var service = STREAMING_SERVICES[serviceKey];
        var items = [];

        for (var catKey in CATEGORIES) {
            items.push({
                title: CATEGORIES[catKey].name,
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

    // Добавление сервисов в меню Лампы
    function init() {
        for (var key in STREAMING_SERVICES) {
            (function(serviceKey) {
                Lampa.Menu.add({
                    title: STREAMING_SERVICES[serviceKey].name,
                    icon: '', // можно добавить SVG иконку
                    onClick: function() {
                        showServiceMenu(serviceKey);
                    }
                });
            })(key);
        }

        console.log('[Plugin] ' + Plugin.name + ' v' + Plugin.version + ' загружен');
        Lampa.Noty.show('Расширение "' + Plugin.name + '" активировано');
    }

    // Старт плагина после загрузки Лампы
    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                init();
            }
        });
    }

})();
