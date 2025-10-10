(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', icon: '...svg...' },
        hbo: { name: 'HBO Max', icon: '...svg...' },
        hulu: { name: 'Hulu', icon: '...svg...' },
        disney: { name: 'Disney+', icon: '...svg...' }
    };

    var CATEGORIES = ['Популярные фильмы', 'Новинки фильмов', 'Популярные сериалы', 'Новинки сериалов'];

    // Получаем данные из Лампы
    function getAllItems() {
        var items = [];
        // Перебираем все компоненты Лампы с данными
        for (var key in Lampa.Components) {
            if (Lampa.Components[key].playlist) {
                items = items.concat(Lampa.Components[key].playlist());
            }
        }
        return items;
    }

    function showFilteredList(serviceKey) {
        var allItems = getAllItems();

        // Фильтруем по выбранному сервису
        var filtered = allItems.filter(function(item){
            return item.services && item.services.includes(serviceKey);
        });

        // Отображаем в виде сетки
        Lampa.Activity.push({
            title: STREAMING_SERVICES[serviceKey].name,
            component: 'grid',
            items: filtered,
            page: 1,
            tabs: CATEGORIES.map(function(name){ return { title: name }; }),
            onTabSelect: function(tabName) {
                // Можно добавить фильтрацию по категории
                var catFiltered = filtered.filter(function(item){
                    return item.category === tabName;
                });
                Lampa.Activity.push({
                    title: STREAMING_SERVICES[serviceKey].name + ' - ' + tabName,
                    component: 'grid',
                    items: catFiltered,
                    page: 1,
                    tabs: this.tabs,
                    onTabSelect: this.onTabSelect
                });
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
