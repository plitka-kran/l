(function() {
    'use strict';

    var Plugin = {
        name: 'Стриминговые сервисы',
        version: '3.0'
    };

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 },
        hulu: { name: 'Hulu', id: 15 },
        disney: { name: 'Disney+', id: 337 }
    };

    var CATEGORIES = {
        movies_popular: { name: 'Популярные фильмы', type: 'movie', sort: 'popularity.desc' },
        movies_new: { name: 'Новинки фильмов', type: 'movie', sort: 'primary_release_date.desc', date_filter: true },
        series_popular: { name: 'Популярные сериалы', type: 'tv', sort: 'popularity.desc' },
        series_new: { name: 'Новинки сериалов', type: 'tv', sort: 'first_air_date.desc', date_filter: true }
    };

    function showContent(serviceKey, categoryKey) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryKey];

        var url = Lampa.TMDB.api(category.type === 'movie' ? 'discover/movie' : 'discover/tv', {
            sort_by: category.sort,
            with_watch_providers: service.id,
            watch_region: 'US',
            'vote_count.gte': 20
        });

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

    function init() {
        // Добавляем пункты меню через Lampa.Menu.add
        for (var key in STREAMING_SERVICES) {
            (function(serviceKey) {
                Lampa.Menu.add({
                    title: STREAMING_SERVICES[serviceKey].name,
                    icon: '', // можно добавить svg иконку
                    onClick: function() {
                        showServiceMenu(serviceKey);
                    }
                });
            })(key);
        }

        console.log('[Plugin] ' + Plugin.name + ' v' + Plugin.version + ' загружен');
        Lampa.Noty.show('Расширение "' + Plugin.name + '" активировано');
    }

    if (window.Lampa) {
        Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') {
                init();
            }
        });
    }

})();
