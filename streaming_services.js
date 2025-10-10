(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 },
        hulu: { name: 'Hulu', id: 15 },
        disney: { name: 'Disney+', id: 337 }
    };

    var CATEGORIES = {
        'Популярные фильмы': { type: 'movie', sort: 'popularity.desc' },
        'Новинки фильмов': { type: 'movie', sort: 'primary_release_date.desc', date_filter: true },
        'Популярные сериалы': { type: 'tv', sort: 'popularity.desc' },
        'Новинки сериалов': { type: 'tv', sort: 'first_air_date.desc', date_filter: true }
    };

    function buildUrl(serviceId, category) {
        var endpoint = category.type === 'movie' ? 'discover/movie' : 'discover/tv';
        var params = {
            sort_by: category.sort,
            with_watch_providers: String(serviceId),
            watch_region: 'UA',
            'vote_count.gte': 20
        };

        if (category.date_filter) {
            var today = new Date();
            var sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
            var dateStr = sixMonthsAgo.toISOString().split('T')[0];
            if (category.type === 'movie') params['primary_release_date.gte'] = dateStr;
            else params['first_air_date.gte'] = dateStr;
        }

        return { endpoint: endpoint, params: params };
    }

    function showService(serviceKey) {
        var service = STREAMING_SERVICES[serviceKey];

        // Создаём массив вкладок
        var tabs = Object.keys(CATEGORIES).map(function(name) {
            return { title: name };
        });

        // Показываем сразу категорию "Популярные фильмы" с вкладками
        Lampa.Activity.push({
            url: buildUrl(service.id, CATEGORIES['Популярные фильмы']),
            title: service.name + ' - Популярные фильмы',
            component: 'category',
            category: true,
            source: 'tmdb',
            type: CATEGORIES['Популярные фильмы'].type,
            page: 1,
            tabs: tabs,
            onTabSelect: function(tabName) {
                var cat = CATEGORIES[tabName];
                Lampa.Activity.push({
                    url: buildUrl(service.id, cat),
                    title: service.name + ' - ' + tabName,
                    component: 'category',
                    category: true,
                    source: 'tmdb',
                    type: cat.type,
                    page: 1,
                    tabs: tabs,
                    onTabSelect: this.onTabSelect // рекурсивно для переключения
                });
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
                    showService(serviceKey);
                });

                $('.menu .menu__list').eq(0).append(button);
            })(key);
        }
    }

    if (window.Lampa) {
        if (window.appready) addMenu();
        else Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') addMenu();
        });
    }

})();
