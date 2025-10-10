(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 },
        // hulu: { name: 'Hulu', id: 15 }, // Недоступний в UA, коментуємо
        // disney: { name: 'Disney+', id: 337 } // Недоступний в UA, коментуємо
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
            'vote_count.gte': 0  // Знижено для більше результатів
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
        var urlData = buildUrl(service.id, category);

        Lampa.TMDB.api(urlData.endpoint, urlData.params).then(function(result) {
            if (!result.results || result.results.length === 0) {
                Lampa.Activity.push({
                    title: service.name + ' - ' + categoryName,
                    component: 'grid',
                    items: [{
                        title: 'Дані недоступні',
                        description: 'Спробуйте іншу категорію або сервіс. Можливо, контент обмежений у регіоні UA.'
                    }],
                    page: 1,
                    tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                    onTabSelect: function(tabName) {
                        showCategory(serviceKey, tabName);
                    }
                });
                return;
            }

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
        }).catch(function(error) {
            console.error('Помилка завантаження даних:', error);
            Lampa.Activity.push({
                title: 'Помилка',
                component: 'grid',
                items: [{
                    title: 'Помилка завантаження',
                    description: error.message || 'Невідома помилка. Перевірте консоль.'
                }],
                page: 1
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
