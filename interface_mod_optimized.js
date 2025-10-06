// === Simple Content Labels for Lampa ===
// by ChatGPT Optimized Edition

(function () {
    const typeLabels = {
        movie: '🎬 Фильм',
        tv: '📺 Сериал',
        anime: '🎞️ Мультсериал',
        cartoon: '🎬 Мультфильм'
    };

    const statusLabels = {
        ended: '✅ Завершён',
        returning: '🔄 Продолжается',
        canceled: '🚫 Отменён',
        paused: '⏸️ Пауза',
        unknown: ''
    };

    // Добавляем метку и статус к карточкам
    function applyLabels(item) {
        if (!item || item.classList.contains('has-label')) return;

        const type = item.dataset.type || '';
        const status = item.dataset.status || '';

        const labelText = typeLabels[type] || '';
        const statusText = statusLabels[status] || '';

        if (!labelText && !statusText) return;

        const label = document.createElement('div');
        label.className = 'mod-label';
        label.textContent = [labelText, statusText].filter(Boolean).join(' • ');

        item.classList.add('has-label');
        item.appendChild(label);
    }

    // Добавляем стили
    const style = document.createElement('style');
    style.textContent = `
        .mod-label {
            position: absolute;
            top: 8px;
            left: 8px;
            background: linear-gradient(90deg, #fc00ff, #00dbde);
            color: white;
            font-size: 12px;
            font-weight: bold;
            padding: 3px 6px;
            border-radius: 5px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.4);
            z-index: 10;
        }
        .card {
            position: relative !important;
        }
    `;
    document.head.appendChild(style);

    // Наблюдаем за карточками
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.card, .card__view').forEach(applyLabels);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Первоначальный запуск
    document.querySelectorAll('.card, .card__view').forEach(applyLabels);

    console.log('%c[InterfaceMod Lite] Лейблы активны', 'color:#00dbde;');
})();
