(function() {
    'use strict';

    var Plugin = {
        name: 'Стриминговые сервисы',
        version: '1.0'
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

    function buildUrl(serviceId, category) {
        var type = category.type;
        var endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';

        var params = {
            sort_by: category.sort,
            with_watch_providers: serviceId,
            watch_region: 'US',
            'vote_count.gte': 20
        };

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

    function addMenu() {
        for (var key in STREAMING_SERVICES) {
            (function(serviceKey) {
                var service = STREAMING_SERVICES[serviceKey];
                var button = $('<li class="menu__item selector">' +
                    '<div class="menu__ico"><svg height="36" viewBox="0 0 38 36" fill="currentColor"></svg></div>' +
                    '<div class="menu__text">' + service.name + '</div>' +
                    '</li>');

                button.on('hover:enter', function() {
                    showServiceMenu(serviceKey);
                });

                $('.menu .menu__list').eq(0).append(button);
            })(key);
        }
    }

    if (window.Lampa) {
        if (window.appready) {
            addMenu();
        } else {
            Lampa.Listener.follow('app', function(e) {
                if (e.type == 'ready') addMenu();
            });
        }
    }

})();
