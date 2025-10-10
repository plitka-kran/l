(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { 
            name: 'Netflix', 
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#E50914"><path d="M5.398 0v.006c3.028 8.556 5.37 15.175 8.348 23.994 2.344.056 4.85.398 7.254.4-3.462-9.547-5.923-16.219-9.15-24.4H5.398z"/></svg>'
        },
        hbo: { 
            name: 'HBO Max', 
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#9c27b0"><circle cx="12" cy="12" r="10"/></svg>'
        },
        hulu: { 
            name: 'Hulu', 
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#3DBB3D"><rect width="24" height="24" rx="4"/></svg>'
        },
        disney: { 
            name: 'Disney+', 
            icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="#113CCF"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>'
        }
    };

    var CATEGORIES = ['Популярные фильмы', 'Новинки фильмов', 'Популярные сериалы', 'Новинки сериалов'];

    var TEST_ITEMS = [];
    for (var i = 1; i <= 12; i++) {
        TEST_ITEMS.push({
            title: 'Тестовый фильм ' + i,
            icon: 'https://via.placeholder.com/200x300?text=Poster+' + i,
            description: 'Краткое описание фильма ' + i,
            rating: (Math.random() * 10).toFixed(1),
            component: 'movie'
        });
    }

    function showCategory(serviceKey, categoryName) {
        Lampa.Activity.push({
            title: STREAMING_SERVICES[serviceKey].name + ' - ' + categoryName,
            component: 'grid', // сетка постеров
            items: TEST_ITEMS,
            page: 1,
            tabs: CATEGORIES.map(function(name){ return { title: name }; }),
            onTabSelect: function(tabName) {
                showCategory(serviceKey, tabName);
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
                    '<div class="menu__ico">' + service.icon + '</div>' +
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
