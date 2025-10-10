// streaming_services.js
class StreamingServices {
    constructor() {
        this.name = 'Streaming Services';
        this.filters = ['Фильмы', 'Сериалы', 'Новинки', 'Популярное'];
        this.tmdbKey = 'ВАШ_TMDB_API_KEY';
        this.serviceMapping = {
            'Netflix': [8, 9],
            'HBO': [10],
            'Hulu': [11],
            'Disney+': [12]
        }; 
        this.menu = Object.keys(this.serviceMapping);
    }

    init() {
        // Добавляем категории в боковое меню Лампы
        this.menu.forEach(service => {
            Lampa.Menu.add({
                title: service,
                icon: '', // можно добавить иконку
                onClick: () => this.showFilters(service)
            });
        });
    }

    showFilters(service) {
        Lampa.Select.show(this.filters, (filter) => {
            this.fetchContent(service, filter);
        });
    }

    async fetchContent(service, filter) {
        Lampa.Loader.show();

        let url = '';
        if (filter === 'Фильмы') {
            url = `https://api.themoviedb.org/3/movie/popular?api_key=${this.tmdbKey}&language=ru-RU&page=1`;
        } else if (filter === 'Сериалы') {
            url = `https://api.themoviedb.org/3/tv/popular?api_key=${this.tmdbKey}&language=ru-RU&page=1`;
        } else if (filter === 'Новинки') {
            url = `https://api.themoviedb.org/3/movie/now_playing?api_key=${this.tmdbKey}&language=ru-RU&page=1`;
        } else if (filter === 'Популярное') {
            url = `https://api.themoviedb.org/3/movie/popular?api_key=${this.tmdbKey}&language=ru-RU&page=1`;
        }

        try {
            const res = await fetch(url);
            const data = await res.json();

            const serviceIds = this.serviceMapping[service] || [];
            const filteredItems = data.results.filter((item, idx) => serviceIds.includes(idx % 12));

            const items = filteredItems.map(item => ({
                title: item.title || item.name,
                poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                url: ''
            }));

            Lampa.Collections.render(items);
        } catch (e) {
            console.error(e);
            Lampa.Loader.hide();
            Lampa.Noty.show('Ошибка загрузки контента');
        }
    }
}

// Регистрируем плагин и инициализируем меню
const plugin = new StreamingServices();
plugin.init();
export default plugin;
