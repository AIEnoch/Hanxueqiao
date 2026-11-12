<template>
    <!-- 对应原 index/about 共用 footer 结构 -->
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-logo">
                    <h3>汉学桥</h3>
                    <p data-i18n="footerSubtitle">多语种译介与跨文化导读平台</p>
                </div>
                <div class="footer-links">
                    <a href="index.html" data-i18n="footerHome" @click.prevent="goHome">首页</a>
                    <a :href="isHome ? '#search' : 'index.html#search'" data-i18n="navCatalog" @click.prevent="goCatalog">篇目目录</a>
                    <a
                        v-if="isHome"
                        href="admin/literature-admin.html"
                        class="footer-editor-open"
                        title="可视化录入文献与章节"
                        data-i18n="footerEditor"
                    >文献录入</a>
                    <a href="about.html" data-i18n="footerAbout" @click.prevent="goAbout">关于我们</a>
                </div>
                <div class="footer-copyright">
                    <p data-i18n="footerCopyright">&copy; 2026 汉学桥项目组. 保留所有权利.</p>
                </div>
            </div>
        </div>
    </footer>
</template>

<script setup>
import { useRoute, useRouter } from 'vue-router';
import { nextTick } from 'vue';

defineProps({
    isHome: {
        type: Boolean,
        default: false
    }
});

const route = useRoute();
const router = useRouter();

function goHome() {
    router.push({ path: '/index.html', query: route.query });
}

function goAbout() {
    router.push({ path: '/about.html', query: route.query });
}

async function goCatalog() {
    if (route.path !== '/' && route.path !== '/index.html') {
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
