<template>
    <!-- 对应原 index/about 共用 header 结构 -->
    <header class="header">
        <div class="container">
            <div class="logo">
                <a href="index.html" class="logo-link" @click.prevent="goHome"><h1>汉学桥</h1></a>
                <p class="subtitle" data-i18n="logoSubtitle">多语种译介与跨文化导读平台</p>
            </div>
            <nav class="nav" aria-label="主导航">
                <ul>
                    <li>
                        <a
                            href="index.html"
                            class="nav-link"
                            :class="{ active: isHome }"
                            data-i18n="navHome"
                            @click.prevent="goHome"
                        >首页</a>
                    </li>
                    <li>
                        <a
                            :href="isHome ? '#search' : 'index.html#search'"
                            class="nav-link"
                            :class="{ active: false }"
                            data-i18n="navCatalog"
                            @click.prevent="goCatalog"
                        >篇目目录</a>
                    </li>
                    <li>
                        <a
                            href="about.html"
                            class="nav-link"
                            :class="{ active: isAbout }"
                            data-i18n="navAbout"
                            @click.prevent="goAbout"
                        >关于我们</a>
                    </li>
                </ul>
            </nav>
            <div class="language-switcher">
                <button type="button" class="lang-btn active" data-lang="zh" aria-pressed="true">中文</button>
                <button type="button" class="lang-btn" data-lang="es" aria-pressed="false">Español</button>
                <button type="button" class="lang-btn" data-lang="pt" aria-pressed="false">Português</button>
                <button type="button" class="lang-btn" data-lang="it" aria-pressed="false">Italiano</button>
                <button type="button" class="lang-btn" data-lang="la" aria-pressed="false">Latina</button>
                <button type="button" class="lang-btn" data-lang="de" aria-pressed="false">Deutsch</button>
            </div>
        </div>
    </header>
</template>

<script setup>
import { computed, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const isHome = computed(() => route.path === '/' || route.path === '/index.html');
const isAbout = computed(() => route.path === '/about' || route.path === '/about.html');

function goHome() {
    router.push({ path: '/index.html', query: route.query });
}

function goAbout() {
    router.push({ path: '/about.html', query: route.query });
}

async function goCatalog() {
    if (!isHome.value) {
        await router.push({ path: '/index.html', hash: '#search', query: route.query });
        return;
    }
    if (route.hash !== '#search') {
        await router.push({ path: '/index.html', hash: '#search', query: route.query });
    }
    await nextTick();
    if (window.HANQIAO && typeof window.HANQIAO.scrollToSearchSection === 'function') {
        window.HANQIAO.scrollToSearchSection();
    }
}
</script>
