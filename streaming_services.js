(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', id: 8 },
        hbo: { name: 'HBO Max', id: 384 }
    };

    var CATEGORIES = {
        'Популярные фильмы': { type: 'movie', sort: 'popularity.desc' },
        'Новинки фильмов': { type: 'movie', sort: 'primary_release_date.desc', date_filter: true },
        'Популярные сериалы': { type: 'tv', sort: 'popularity.desc' },
        'Новинки сериалов': { type: 'tv', sort: 'first_air_date.desc', date_filter: true }
    };

    function getDiscoverParams(category) {
        var params = {
            sort_by: category.sort,
            page: 1
        };

        if (category.date_filter) {
            var today = new Date();
            var sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, today.getDate());
            var dateStr = sixMonthsAgo.toISOString().split('T')[0];
            if (category.type === 'movie') params['primary_release_date.gte'] = dateStr;
            else params['first_air_date.gte'] = dateStr;
        }

        return params;
    }

    function filterByProvider(items, serviceId, type) {
        var promises = items.slice(0, 50).map(function(item) {  // Топ-50 для перевірки
            var endpoint = type === 'movie' ? `movie/${item.id}/watch/providers` : `tv/${item.id}/watch/providers`;
            return Lampa.TMDB.api(endpoint, { region: 'UA' }).then(function(providers) {
                var flatrate = providers.results?.UA?.flatrate || [];
                return flatrate.some(function(p) { return p.provider_id === serviceId; }) ? item : null;
            }).catch(function() { return null; });
        });

        return Promise.all(promises).then(function(filtered) {
            return filtered.filter(Boolean).slice(0, 20);  // Топ-20 релевантних
        });
    }

    function showCategory(serviceKey, categoryName) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryName];
        var params = getDiscoverParams(category);
        var endpoint = category.type === 'movie' ? 'discover/movie' : 'discover/tv';

        console.log('Завантажуємо discover для', categoryName, 'сервіс:', service.name);  // Лог для діагностики

        Lampa.TMDB.api(endpoint, params).then(function(result) {
            console.log('Discover results count:', result.results?.length || 0);  // Лог

            if (!result.results || result.results.length === 0) {
                Lampa.Activity.push({
                    title: service.name + ' - ' + categoryName,
                    component: 'grid',
                    items: [{ title: 'Немає результатів', description: 'Спробуйте іншу категорію.' }],
                    page: 1,
                    tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                    onTabSelect: function(tabName) { showCategory(serviceKey, tabName); }
                });
                return;
            }

            // Фільтруємо за провайдером
            filterByProvider(result.results, service.id, category.type).then(function(filteredItems) {
                console.log('Filtered items count:', filteredItems.length);  // Лог

                if (filteredItems.length === 0) {
                    Lampa.Activity.push({
                        title: service.name + ' - ' + categoryName,
                        component: 'grid',
                        items: [{ title: 'Контент не знайдено в UA', description: 'Можливо, мало доступного на сервісі.' }],
                        page: 1,
                        tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                        onTabSelect: function(tabName) { showCategory(serviceKey, tabName); }
                    });
                    return;
                }

                var items = filteredItems.map(function(item) {
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
                    component: 'grid',
                    items: items,
                    page: 1,
                    tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                    onTabSelect: function(tabName) { showCategory(serviceKey, tabName); }
                });
            }).catch(function(error) {
                console.error('Помилка фільтрації:', error);
                // Fallback: показуємо без фільтра
                var items = result.results.slice(0, 20).map(function(item) {
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
                    title: service.name + ' - ' + categoryName + ' (без фільтра)',
                    component: 'grid',
                    items: items,
                    page: 1,
                    tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
                    onTabSelect: function(tabName) { showCategory(serviceKey, tabName); }
                });
            });
        }).catch(function(error) {
            console.error('Помилка discover:', error);
            Lampa.Activity.push({
                title: 'Помилка',
                component: 'grid',
                items: [{ title: 'Помилка завантаження', description: error.message || 'Перевірте консоль.' }],
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
