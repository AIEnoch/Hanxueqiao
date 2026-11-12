import { createApp, nextTick } from 'vue';
import App from './App.vue';
import router from './router';
import './style/style.css';
import '../data/literature-site.js';
import '../js/literature-core.js';
import '../js/articles-data.js';
import '../script.js';

router.afterEach(async (to) => {
    await nextTick();
    const body = document.body;
    body.className = to.meta.pageClass || 'page-home';
    body.classList.add('site-scenic');
    if (to.meta.skipTitleI18n) body.setAttribute('data-skip-i18n-title', '');
    else body.removeAttribute('data-skip-i18n-title');

    if (window.HANQIAO) {
        if (to.meta.pageClass === 'page-home') {
            if (typeof window.HANQIAO.initArticleSearch === 'function') window.HANQIAO.initArticleSearch();
            if (typeof window.HANQIAO.initSearchCharPicker === 'function') window.HANQIAO.initSearchCharPicker();
            if (typeof window.HANQIAO.initSearchCharToggle === 'function') window.HANQIAO.initSearchCharToggle();
            if (typeof window.HANQIAO.renderArticleSearchResults === 'function') window.HANQIAO.renderArticleSearchResults();
        }
        if (to.hash === '#search' && typeof window.HANQIAO.scrollToSearchSection === 'function') {
            requestAnimationFrame(() => {
                window.HANQIAO.scrollToSearchSection();
            });
        }
        if (typeof window.HANQIAO.updateLanguageContent === 'function') {
            const active = document.querySelector('.lang-btn.active');
            const lang = active ? active.getAttribute('data-lang') : 'zh';
            window.HANQIAO.updateLanguageContent(lang || 'zh');
        }
    }
});

const app = createApp(App);
app.use(router);
app.mount('#app');
