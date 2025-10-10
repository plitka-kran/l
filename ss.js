(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="red"><path d="M4 2.5C2.62 2.5 1.5 3.62 1.5 5v14c0 1.38 1.12 2.5 2.5 2.5h15c1.38 0 2.5-1.12 2.5-2.5V5c0-1.38-1.12-2.5-2.5-2.5H4z"/></svg>' },
        hbo: { name: 'HBO Max', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="black"><rect width="24" height="24" rx="4"/></svg>' },
        hulu: { name: 'Hulu', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="green"><circle cx="12" cy="12" r="10" stroke="green" fill="none"/></svg>' },
        disney: { name: 'Disney+', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="blue"><path d="M12 2L2 7v10l10 5 10-5V7z"/></svg>' }
    };

    var CATEGORIES = ['Популярные фильмы', 'Новинки фильмов', 'Популярные сериалы', 'Новинки сериалов'];

    // Маппинг категорий для фильтра (адаптируйте под вашу структуру данных)
    function getCategoryFilter(tabName) {
        if (tabName === 'Популярные фильмы') return { type: 'movie', isNew: false };
        if (tabName === 'Новинки фильмов') return { type: 'movie', isNew: true };
        if (tabName === 'Популярные сериалы') return { type: 'serial', isNew: false };
        if (tabName === 'Новинки сериалов') return { type: 'serial', isNew: true };
        return { type: null, isNew: null }; // Все
    }

    function showFilteredList(serviceKey, parentTabs) {
        var service = STREAMING_SERVICES[serviceKey];
        if (!service) return; // Нет сервиса

        var component = Lampa.Components[serviceKey];
        if (!component || typeof component.playlist !== 'function') {
            Lampa.Noty.show('Компонент для ' + service.name + ' не найден.');
            return;
        }

        var allItems = component.playlist() || []; // Получаем только из нужного компонента

        if (allItems.length === 0) {
            Lampa.Noty.show('Нет контента для ' + service.name + '.');
            return;
        }

        var tabs = parentTabs || CATEGORIES.map(function(name) { return { title: name }; });

        Lampa.Activity.push({
            title: service.name,
            component: 'grid',
            items: allItems,
            page: 1,
            tabs: tabs,
            onTabSelect: function(tabName, thisActivity) {
                var filter = getCategoryFilter(tabName);
                var catFiltered = allItems.filter(function(item) {
                    var matchesType = !filter.type || (item.type === filter.type || item.content_type === filter.type);
                    var matchesNew = !filter.isNew || (filter.isNew ? (item.released || 2024) >= 2024 : true); // Пример: новинки — год >= 2024, адаптируйте
                    return matchesType && matchesNew;
                });

                Lampa.Activity.push({
                    title: service.name + ' - ' + tabName,
                    component: 'grid',
                    items: catFiltered.length > 0 ? catFiltered : allItems, // Fallback на все, если ничего не найдено
                    page: 1,
                    tabs: tabs,
                    onTabSelect: thisActivity.onTabSelect // Рекурсия
                });
            }
        });
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
