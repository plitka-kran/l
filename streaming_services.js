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

    function buildParams(serviceId, category) {
        var params = {
            sort_by: category.sort,
            with_watch_providers: serviceId,
            watch_region: 'RU', // Смени на 'RU' для России, если мало контента
            language: 'ru-RU',
            'vote_count.gte': 20,
            page: 1
        };

        var endpoint = category.type === 'movie' ? '/discover/movie' : '/discover/tv';

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
        console.log('Streaming: Показываем категорию', categoryName, 'для', serviceKey);
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryName];
        var query = buildParams(service.id, category);

        // Fetch через встроенный TMDB
        Lampa.TMDB.request(query.endpoint, query.params).then(function(data) {
            console.log('Streaming: Данные получены', data);
            if (!data.results || data.results.length === 0) {
                Lampa.Noty.show('Контент не найден для ' + categoryName + ' на ' + service.name);
                return;
            }

            var items = data.results.map(function(item) {
                return {
                    title: item.title || item.name,
                    original_title: item.original_title || item.original_name,
                    img: 'https://image.tmdb.org/t/p/w300' + (item.poster_path || ''),
                    description: item.overview || '',
                    year: item.release_date ? new Date(item.release_date).getFullYear() : (item.first_air_date ? new Date(item.first_air_date).getFullYear() : ''),
                    id: item.id,
                    type: category.type
                };
            }).filter(function(item) { return item.img; }); // Только с постерами

            console.log('Streaming: Обработано items', items.length);

            if (items.length === 0) {
                Lampa.Noty.show('Нет контента с постерами');
                return;
            }

            // HTML для карточек
            var html = '';
            items.slice(0, 20).forEach(function(item) { // Лимит 20
                html += '<div class="full-item selector" data-item=\'' + JSON.stringify(item).replace(/'/g, "\\'") + '\' style="cursor: pointer;">' +
                    '<div class="full-item__img" style="background-image: url(' + item.img + '); background-size: cover;"></div>' +
                    '<div class="full-item__title">' + item.title + ' (' + item.year + ')</div>' +
                    '<div class="full-item__text">' + (item.description.substring(0, 100) || '') + '...</div>' +
                    '</div>';
            });

            // Push в full с обработчиком
            var activity = {
                url: '',
                title: service.name + ' - ' + categoryName,
                component: 'full',
                html: '<div class="full-start__body selector">' + html + '</div>',
                onBack: function() { Lampa.Activity.back(); }
            };

            activity.toggle = function() {
                $('.full-item').on('hover:enter', function() {
                    var itemStr = $(this).attr('data-item');
                    var item = JSON.parse(itemStr.replace(/\\'/g, "'"));
                    Lampa.Activity.push({
                        url: item.id,
                        component: 'full',
                        movie: { object: item },
                        page: 1
                    });
                });
            };

            Lampa.Activity.push(activity);
        }).catch(function(err) {
            console.error('Streaming: Ошибка TMDB', err);
            Lampa.Noty.show('Ошибка загрузки: ' + err.message + '. Проверь TMDB Proxy в плагинах.');
        });
    }

    function showService(serviceKey) {
        // При выборе сервиса сразу показываем категории
        var items = [];
        for (var catName in CATEGORIES) {
            items.push({ title: catName, category: catName });
        }

        Lampa.Select.show({
            title: STREAMING_SERVICES[serviceKey].name,
            items: items,
            onSelect: function(a) {
                showCategory(serviceKey, a.category);
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
                    showService(serviceKey);
                });

                $('.menu .menu__list').eq(0).append(button);
            })(key);
        }
        console.log('Streaming: Меню добавлено для', Object.keys(STREAMING_SERVICES));
    }

    if (window.Lampa) {
        if (window.appready) addMenu();
        else Lampa.Listener.follow('app', function(e) {
            if (e.type === 'ready') addMenu();
        });
    }

})();
