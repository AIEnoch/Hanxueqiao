<template>
    <!-- 对应原 about.html 的 <main class="page-article-main">...</main> -->
    <main class="page-article-main">
        <div class="article-context">
            <div class="container">
                <a href="index.html" data-i18n="navHome" @click.prevent="goHome">首页</a>
                <span class="article-context-sep">/</span>
                <span data-i18n="aboutTitle">关于我们</span>
            </div>
        </div>
        <section id="about" class="about-section">
            <div class="container">
                <h2 class="section-title" data-i18n="aboutTitle">关于我们</h2>
                <p class="section-subtitle" data-i18n="aboutSubtitle">项目简介</p>
                <div class="about-content">
                    <div class="about-text">
                        <p data-i18n="aboutP1">「汉学桥」多语种译介与跨文化导读平台立足国际汉学与跨文化传播视角，依托汉学专业功底及西班牙语、葡萄牙语、意大利语多语种能力，致力于解决汉学文献「有译但难懂」的跨文化困境。</p>
                        <p data-i18n="aboutP2">我们精选中华传统经典与现当代汉学著作，面向西、葡、意三大语种做精准译介与跨文化导读；同时以拉丁语作为西方语言文化溯源研究工具，对照解析罗曼语族语义根源与文化思维差异，补足普通翻译的文化断层，消解海外受众理解壁垒，助力中华经典精准出海、中外文明互鉴。</p>
                    </div>
                </div>
            </div>
        </section>
    </main>
</template>

<script setup>
import { nextTick, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const router = useRouter();
const route = useRoute();

function goHome() {
    router.push({ path: '/index.html', query: route.query });
}

onMounted(async () => {
    await nextTick();
    if (window.HANQIAO && typeof window.HANQIAO.updateLanguageContent === 'function') {
        const active = document.querySelector('.lang-btn.active');
        const lang = active ? active.getAttribute('data-lang') : 'zh';
        window.HANQIAO.updateLanguageContent(lang || 'zh');
    }
});
</script>
