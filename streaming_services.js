(function() {
    'use strict';

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
        }
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

    function showCategory(serviceKey, categoryName) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryName];

        // Загружаем данные через TMDb
        Lampa.TMDB.api(category.type === 'movie' ? 'discover/movie' : 'discover/tv', {
            sort_by: category.sort,
            with_watch_providers: String(service.id),
            watch_region: 'UA',
            'vote_count.gte': 20,
            ...(category.date_filter ? (category.type === 'movie' ? { 'primary_release_date.gte': new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0] } : { 'first_air_date.gte': new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0] }) : {})
        }).then(function(result) {
            // Формируем сетку постеров
            var items = result.results.map(function(item) {
                return {
                    title: item.title || item.name,
                    icon: item.poster_path ? 'https://image.tmdb.org/t/p/w500' + item.poster_path : '',
                    description: item.overview ? item.overview.substring(0, 120) + '...' : '',
                    rating: item.vote_average ? item.vote_average.toFixed(1) : 'N/A',
                    url: item.id,
                    component: category.type
                };
            });

            Lampa.Activity.push({
                title: service.name + ' - ' + categoryName,
                component: 'grid', // сетка постеров
                items: items,
                page: 1,
                tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                onTabSelect: function(tabName) {
                    showCategory(serviceKey, tabName);
                }
            });
        });
    }

    function showService(serviceKey) {
        showCategory(serviceKey, 'Популярные фильмы');
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
