/**
 * 首页「篇目检索」数据源。
 * 若已加载 data/literature-site.js，则由站点总配置自动生成 ARTICLES；
 * 否则回退为空数组（请先引入文献站点脚本）。
 */
(function () {
    'use strict';
    if (
        typeof window !== 'undefined' &&
        window.LITERATURE_SITE &&
        window.HANQIAO &&
        typeof window.HANQIAO.buildArticlesFromLiterature === 'function'
    ) {
        try {
            window.ARTICLES = window.HANQIAO.buildArticlesFromLiterature(window.LITERATURE_SITE);
            return;
        } catch (e) {
            /* fallthrough */
        }
    }
    window.ARTICLES = [];
})();
