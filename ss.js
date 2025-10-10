(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', icon: '...svg...' },
        hbo: { name: 'HBO Max', icon: '...svg...' },
        hulu: { name: 'Hulu', icon: '...svg...' },
        disney: { name: 'Disney+', icon: '...svg...' }
    };

    var CATEGORIES = [
        { key: 'popular_movies', title: 'Популярные фильмы', type: 'movie', mark: 'popular' },
        { key: 'new_movies', title: 'Новинки фильмов', type: 'movie', mark: 'new' },
        { key: 'popular_tv', title: 'Популярные сериалы', type: 'tv', mark: 'popular' },
        { key: 'new_tv', title: 'Новинки сериалов', type: 'tv', mark: 'new' }
    ];

    function getAllItems() {
        var items = [];
        for (var key in Lampa.Components) {
            if (Lampa.Components[key].playlist) {
                items = items.concat(Lampa.Components[key].playlist());
            }
        }
        return items;
    }

    function showFilteredList(serviceKey) {
        var allItems = getAllItems();

        // Фильтруем по сервису
        var filtered = allItems.filter(function(item){
            return item.origin && item.origin === serviceKey; // обычно origin содержит источник
        });

        // Настройка tabs
        var tabs = CATEGORIES.map(function(cat){ return { title: cat.title }; });

        // Показываем первый таб по умолчанию
        renderGrid(serviceKey, filtered, CATEGORIES[0], tabs);
    }

    function renderGrid(serviceKey, items, category, tabs) {
        var catFiltered = items.filter(function(item){
            return item.type === category.type && item.mark === category.mark;
        });

        Lampa.Activity.push({
            title: STREAMING_SERVICES[serviceKey].name + ' - ' + category.title,
            component: 'grid',
            items: catFiltered,
            page: 1,
            tabs: tabs,
            onTabSelect: function(tabName){
                var cat = CATEGORIES.find(c => c.title === tabName);
                if(cat) renderGrid(serviceKey, items, cat, tabs);
            }
        });
    }

    function addMenu() {
        for (var key in STREAMING_SERVICES) {
            (function(serviceKey){
                var service = STREAMING_SERVICES[serviceKey];
                var button = $('<li class="menu__item selector">' +
                    '<div class="menu__ico">' + service.icon + '</div>' +
                    '<div class="menu__text">' + service.name + '</div>' +
                '</li>');

                button.on('hover:enter', function() {
                    showFilteredList(serviceKey);
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
