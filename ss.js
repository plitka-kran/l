(function() {
    'use strict';

    var STREAMING_SERVICES = {
        netflix: { name: 'Netflix' },
        hbo: { name: 'HBO Max' }
    };

    // Статичні списки на жовтень 2025 (топи з джерел)
    var CONTENT_LISTS = {
        netflix: {
            'Популярные фильмы': [
                { title: 'Beverly Hills Cop', description: 'Класичний екшн з Едді Мерфі.', rating: '7.4' },
                { title: 'The Hurt Locker', description: 'Військовий трилер про саперів.', rating: '7.5' },
                { title: 'The Martian', description: 'Космічна виживальна драма з Меттом Деймоном.', rating: '8.0' },
                { title: 'Hacksaw Ridge', description: 'Історія героя Другої світової.', rating: '8.1' },
                { title: 'The Mask', description: 'Комедія з Джимом Керрі.', rating: '6.9' },
                { title: 'Scarface', description: 'Кримінальна сага з Аль Пачіно.', rating: '8.3' }
            ],
            'Новинки фильмов': [
                { title: 'A House of Dynamite', description: 'Новий екшн-трилер від Netflix.', rating: 'N/A' },
                { title: 'Molly\'s Game', description: 'Драма про покер з Джессікою Честейн.', rating: '7.4' },
                { title: 'The Lincoln Lawyer', description: 'Юридичний трилер.', rating: '7.7' },
                { title: 'The Goonies', description: 'Пригодницька класика для фанів.', rating: '7.7' },
                { title: 'Final Destination', description: 'Хорор про долю.', rating: '6.2' },
                { title: 'Friendship', description: 'Нова комедія-драма.', rating: 'N/A' }
            ],
            'Популярные сериалы': [
                { title: 'Love Is Blind', description: 'Реаліті-шоу про кохання без фото.', rating: '6.0' },
                { title: 'Nobody Wants This', description: 'Романтична комедія S2.', rating: '7.5' },
                { title: 'The Diplomat', description: 'Політичний трилер S3.', rating: '8.0' },
                { title: 'Boots', description: 'Новий драматичний серіал.', rating: 'N/A' },
                { title: 'Splinter Cell: Deathwatch', description: 'Шпигунський екшн.', rating: 'N/A' },
                { title: 'Monster: The Ed Gein Story', description: 'Тру-крайм міні-серіал.', rating: 'N/A' }
            ],
            'Новинки сериалов': [
                { title: 'Nobody Wants This S2', description: 'Продовження романтики.', rating: '7.5' },
                { title: 'The Diplomat S3', description: 'Нові інтриги в дипломатії.', rating: '8.0' },
                { title: 'Boots', description: 'Свіжий реліз жовтня.', rating: 'N/A' },
                { title: 'Monster: The Ed Gein Story', description: 'Жахлива історія вбивці.', rating: 'N/A' },
                { title: 'Splinter Cell: Deathwatch', description: 'Адаптація гри в серіал.', rating: 'N/A' },
                { title: 'Love Is Blind S7', description: 'Нові пари в пошуку.', rating: '6.0' }
            ]
        },
        hbo: {
            'Популярные фильмы': [
                { title: 'Superman', description: 'Супергеройський блокбастер.', rating: 'N/A' },
                { title: 'Warfare', description: 'Військовий екшн.', rating: 'N/A' },
                { title: 'Freaky Tales', description: 'Темна комедія.', rating: 'N/A' },
                { title: 'The Naked Gun', description: 'Ремейк класичної комедії.', rating: 'N/A' },
                { title: 'How to Train Your Dragon', description: 'Анімація для всієї родини.', rating: '8.1' },
                { title: 'Sorry Baby', description: 'Романтична драма.', rating: 'N/A' }
            ],
            'Новинки фильмов': [
                { title: 'Bring Her Back', description: 'Хорор від A24.', rating: 'N/A' },
                { title: 'Jurassic World Rebirth', description: 'Новий динозавр-трилер.', rating: 'N/A' },
                { title: 'Superman', description: 'Дебют нового Супермена.', rating: 'N/A' },
                { title: 'Warfare', description: 'Свіжий реліз жовтня.', rating: 'N/A' },
                { title: 'Freaky Tales', description: 'Незвичайні історії.', rating: 'N/A' },
                { title: 'Final Destination', description: 'Ремейк хорору.', rating: '6.2' }
            ],
            'Популярные сериалы': [
                { title: 'Hacks S4', description: 'Комедія про стендап.', rating: '8.2' },
                { title: 'Conan O\'Brien Must Go S2', description: 'Тревел-шоу з гумором.', rating: '8.0' },
                { title: 'Duster', description: 'Кримінальна драма.', rating: 'N/A' },
                { title: 'The Mortician', description: 'Темний серіал.', rating: 'N/A' },
                { title: 'Smiling Friends', description: 'Анімаційна комедія.', rating: '8.6' },
                { title: 'Task', description: 'Щотижневий екшн.', rating: 'N/A' }
            ],
            'Новинки сериалов': [
                { title: 'The Last Of Us S2', description: 'Постапокаліпсис з Педро Паскалем.', rating: '8.7' },
                { title: 'IT: Welcome to Derry', description: 'Пріquel до "Воно".', rating: 'N/A' },
                { title: 'Hacks S4', description: 'Нові пригоди комікес.', rating: '8.2' },
                { title: 'Duster', description: 'Свіжий кримінал.', rating: 'N/A' },
                { title: 'Conan O\'Brien Must Go S2', description: 'Нові подорожі.', rating: '8.0' },
                { title: 'The Mortician', description: 'Хорор-серіал жовтня.', rating: 'N/A' }
            ]
        }
    };

    var CATEGORIES = {
        'Популярные фильмы': { type: 'movie' },
        'Новинки фильмов': { type: 'movie' },
        'Популярные сериалы': { type: 'tv' },
        'Новинки сериалов': { type: 'tv' }
    };

    function showCategory(serviceKey, categoryName) {
        var service = STREAMING_SERVICES[serviceKey];
        var category = CATEGORIES[categoryName];
        var items = CONTENT_LISTS[serviceKey][categoryName] || [];

        // Додаємо іконки та url для пошуку (порожня іконка, Lampa підтягне)
        items = items.map(function(item) {
            return {
                title: item.title,
                icon: '',  // Порожня, або додай 'https://image.tmdb.org/t/p/w500/[path]' якщо знаєш
                description: item.description,
                rating: item.rating,
                url: item.title  // Для пошуку по назві
            };
        });

        Lampa.Activity.push({
            title: service.name + ' - ' + categoryName,
            component: 'grid',
            items: items,
            page: 1,
            tabs: Object.keys(CATEGORIES).map(function(name) { return { title: name }; }),
            onTabSelect: function(tabName) {
                showCategory(serviceKey, tabName);
            },
            // При кліку на елемент — пошук у Lampa для перегляду
            onSelect: function(item) {
                Lampa.Activity.push({
                    url: 'online',  // Або 'torrent' якщо хочеш торренти
                    component: 'full',
                    search: item.url,  // Пошук по назві
                    search_one: item.url,
                    page: 1
                });
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
