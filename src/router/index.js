import { createRouter, createWebHistory } from 'vue-router';
import Home from '../views/Home.vue';
import About from '../views/About.vue';

const router = createRouter({
    history: createWebHistory(),
    scrollBehavior(to) {
        if (to.hash) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve({ el: to.hash, top: 100, behavior: 'auto' });
                }, 50);
            });
        }
        return { top: 0, behavior: 'auto' };
    },
    routes: [
        { path: '/', component: Home, meta: { pageClass: 'page-home', skipTitleI18n: false } },
        { path: '/index.html', component: Home, meta: { pageClass: 'page-home', skipTitleI18n: false } },
        { path: '/about', component: About, meta: { pageClass: 'page-about', skipTitleI18n: true } },
        { path: '/about.html', component: About, meta: { pageClass: 'page-about', skipTitleI18n: true } }
    ]
});

export default router;
