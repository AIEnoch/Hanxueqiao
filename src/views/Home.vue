<template>
    <!-- 对应原 index.html 的 <main class="home-main">...</main> -->
    <main class="home-main">
        <section class="hero">
            <div class="container">
                <div class="hero-content">
                    <h2 class="hero-title" data-i18n="heroTitle">《道德经》章节导读与多语种检索</h2>
                </div>
                <section
                    id="search"
                    class="home-search-section home-search-in-hero"
                    aria-label="检索《道德经》"
                    data-i18n-aria-label="searchTitle"
                >
                    <div class="hero-search-card">
                        <form id="articleSearchForm" class="search-panel" role="search" action="index.html" method="get">
                            <div class="search-row">
                                <input
                                    id="articleSearchInput"
                                    type="search"
                                    name="q"
                                    autocomplete="off"
                                    data-i18n-placeholder="searchPlaceholder"
                                    data-i18n-aria-label="searchInputLabel"
                                    placeholder="搜索章名、原文、译文或术语，如：道可道、无为…"
                                    aria-label="关键词"
                                >
                                <button type="submit" class="search-submit" data-i18n="searchButton">搜索</button>
                            </div>
                            <div class="search-chars" role="group" aria-labelledby="search-chars-desc">
                                <p id="search-chars-desc" class="search-chars-head">
                                    <span data-i18n="searchCharsTitle">多语种输入辅助：</span>
                                    <span class="search-chars-hint" data-i18n="searchCharsHint">展开可选西、葡、意、拉丁语与德语字符。</span>
                                </p>
                                <div class="search-chars-compact-row">
                                    <div class="search-chars-btns search-chars-btns-compact" aria-label="高频常用字符">
                                        <button type="button" class="search-char-btn" data-insert-char="á" title="á">á</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ñ" title="ñ">ñ</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ã" title="ã">ã</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ç" title="ç">ç</button>
                                        <button type="button" class="search-char-btn" data-insert-char="à" title="à">à</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ā" title="ā">ā</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ü" title="ü">ü</button>
                                        <button type="button" class="search-char-btn" data-insert-char="ß" title="ß">ß</button>
                                        <button
                                            type="button"
                                            class="search-chars-toggle"
                                            data-char-toggle
                                            data-i18n="searchCharsExpand"
                                            aria-expanded="false"
                                        >
                                            更多字符 ▼
                                        </button>
                                    </div>
                                </div>
                                <div class="search-chars-expanded" data-char-expanded>
                                    <div class="search-char-group">
                                        <p class="search-char-group-label">Español</p>
                                        <div class="search-chars-btns">
                                            <button type="button" class="search-char-btn" data-insert-char="á" title="á">á</button>
                                            <button type="button" class="search-char-btn" data-insert-char="é" title="é">é</button>
                                            <button type="button" class="search-char-btn" data-insert-char="í" title="í">í</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ó" title="ó">ó</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ú" title="ú">ú</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ñ" title="ñ">ñ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="¡" title="¡">¡</button>
                                            <button type="button" class="search-char-btn" data-insert-char="¿" title="¿">¿</button>
                                        </div>
                                    </div>
                                    <div class="search-char-group">
                                        <p class="search-char-group-label">Português</p>
                                        <div class="search-chars-btns">
                                            <button type="button" class="search-char-btn" data-insert-char="ã" title="ã">ã</button>
                                            <button type="button" class="search-char-btn" data-insert-char="õ" title="õ">õ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ç" title="ç">ç</button>
                                            <button type="button" class="search-char-btn" data-insert-char="à" title="à">à</button>
                                            <button type="button" class="search-char-btn" data-insert-char="é" title="é">é</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ê" title="ê">ê</button>
                                            <button type="button" class="search-char-btn" data-insert-char="í" title="í">í</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ó" title="ó">ó</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ô" title="ô">ô</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ú" title="ú">ú</button>
                                        </div>
                                    </div>
                                    <div class="search-char-group">
                                        <p class="search-char-group-label">Italiano</p>
                                        <div class="search-chars-btns">
                                            <button type="button" class="search-char-btn" data-insert-char="à" title="à">à</button>
                                            <button type="button" class="search-char-btn" data-insert-char="è" title="è">è</button>
                                            <button type="button" class="search-char-btn" data-insert-char="é" title="é">é</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ì" title="ì">ì</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ò" title="ò">ò</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ù" title="ù">ù</button>
                                        </div>
                                    </div>
                                    <div class="search-char-group">
                                        <p class="search-char-group-label">Latin</p>
                                        <div class="search-chars-btns">
                                            <button type="button" class="search-char-btn" data-insert-char="ā" title="ā">ā</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ē" title="ē">ē</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ī" title="ī">ī</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ō" title="ō">ō</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ū" title="ū">ū</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ȳ" title="ȳ">ȳ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="æ" title="æ">æ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="œ" title="œ">œ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ā" title="Ā">Ā</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ē" title="Ē">Ē</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ī" title="Ī">Ī</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ō" title="Ō">Ō</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ū" title="Ū">Ū</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ȳ" title="Ȳ">Ȳ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Æ" title="Æ">Æ</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Œ" title="Œ">Œ</button>
                                        </div>
                                    </div>
                                    <div class="search-char-group">
                                        <p class="search-char-group-label">Deutsch</p>
                                        <div class="search-chars-btns">
                                            <button type="button" class="search-char-btn" data-insert-char="ä" title="ä">ä</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ö" title="ö">ö</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ü" title="ü">ü</button>
                                            <button type="button" class="search-char-btn" data-insert-char="ß" title="ß">ß</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ä" title="Ä">Ä</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ö" title="Ö">Ö</button>
                                            <button type="button" class="search-char-btn" data-insert-char="Ü" title="Ü">Ü</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </form>
                        <div id="articleSearchResults" class="search-results" aria-live="polite"></div>
                    </div>
                </section>
            </div>
        </section>
    </main>
</template>

<script setup>
import { nextTick, onMounted } from 'vue';

onMounted(async () => {
    await nextTick();
    if (window.HANQIAO) {
        if (typeof window.HANQIAO.initArticleSearch === 'function') window.HANQIAO.initArticleSearch();
        if (typeof window.HANQIAO.initSearchCharPicker === 'function') window.HANQIAO.initSearchCharPicker();
        if (typeof window.HANQIAO.initSearchCharToggle === 'function') window.HANQIAO.initSearchCharToggle();
        if (typeof window.HANQIAO.renderArticleSearchResults === 'function') window.HANQIAO.renderArticleSearchResults();
        if (typeof window.HANQIAO.getInitialUiLang === 'function' && typeof window.HANQIAO.updateLanguageContent === 'function') {
            const lang = window.HANQIAO.getInitialUiLang();
            window.HANQIAO.updateLanguageContent(lang);
        }
        if (window.location.hash === '#search' && typeof window.HANQIAO.scrollToSearchSection === 'function') {
            requestAnimationFrame(() => {
                window.HANQIAO.scrollToSearchSection();
            });
        }
    }
});
</script>
