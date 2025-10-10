class StreamingServices {
    constructor() {
        this.menu = ['Netflix', 'HBO', 'Hulu', 'Disney+'];
        this.filters = ['Фильмы', 'Сериалы', 'Новинки', 'Популярное'];
        this.serviceMapping = {
            'Netflix': [8, 9],
            'HBO': [10],
            'Hulu': [11],
            'Disney+': [12]
        };
    }

    init() {
        this.menu.forEach(service => {
            Lampa.Menu.add({
                title: service,
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

        let promise;

        if (filter === 'Фильмы') {
            promise = Lampa.TMDB.moviePopular(); // встроенный метод TMDb для популярных фильмов
        } else if (filter === 'Сериалы') {
            promise = Lampa.TMDB.tvPopular(); // популярные сериалы
        } else if (filter === 'Новинки') {
            promise = Lampa.TMDB.movieNowPlaying(); // новинки фильмов
        } else if (filter === 'Популярное') {
            promise = Lampa.TMDB.moviePopular(); 
        }

        try {
            const data = await promise;
            const serviceIds = this.serviceMapping[service] || [];
            const filteredItems = data.results.filter((item, idx) => serviceIds.includes(idx % 12));

            const items = filteredItems.map(item => ({
                title: item.title || item.name,
                poster: item.poster_path ? `https://image.tmdb.org/t/p/w300${item.poster_path}` : '',
                url: ''
            }));

            Lampa.Collections.render(items);

        } catch(e) {
            console.error(e);
            Lampa.Loader.hide();
            Lampa.Noty.show('Ошибка загрузки контента');
        }
    }
}

const plugin = new StreamingServices();
plugin.init();
export default plugin;
