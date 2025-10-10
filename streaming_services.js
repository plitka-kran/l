(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', search: 'netflix original' },
        hbo: { name: 'HBO Max', search: 'hbo max' }
    };

    var CATEGORIES = {
        'Популярные фильмы': { type: 'movie', sort: 'popularity' },
        'Новинки фильмов': { type: 'movie', sort: 'release' },
        'Популярные сериалы': { type: 'tv', sort: 'popularity' },
        'Новинки сериалов': { type: 'tv', sort: 'release' }
    };

    function showCategory(serviceKey, categoryName) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryName];

        // Використовуємо вбудований 'full' компонент для онлайн-провайдерів
        // Пошук з ключовими словами сервісу + тип (movie/tv)
        var query = service.search + ' ' + (category.type === 'movie' ? 'фильм' : 'сериал');
        if (category.sort === 'release') query += ' новинка';  // Для новинок

        Lampa.Activity.push({
            title: service.name + ' - ' + categoryName,
            url: 'online',  // Вбудований провайдер онлайн (Rezka тощо)
            component: 'full',
            search: query,  // Автоматичний пошук
            search_one: query,  // Альтернативний пошук
            page: 1,
            genres: [],  // Без жанрів для ширшого пошуку
            filters: {  // Фільтри для сортування
                sort: { by: category.sort, order: 'desc' },
                year: { from: new Date().getFullYear() - 1 }  // Останній рік для новинок
            },
            tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
            onTabSelect: function(tabName) {
                showCategory(serviceKey, tabName);
            },
            onBack: function() {
                Lampa.Activity.backward();
            }
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
