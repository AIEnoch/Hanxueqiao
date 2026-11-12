<template>
    <!-- 全站固定背景：水墨图 + 米白遮罩 + 宣纸纹理 -->
    <div class="site-bg" :class="{ 'is-loaded': loaded }" aria-hidden="true">
        <div class="site-bg__placeholder"></div>
        <img
            class="site-bg__image"
            :src="siteBgUrl"
            alt=""
            decoding="async"
            fetchpriority="high"
            @load="markLoaded"
            @error="markLoaded"
        />
        <div class="site-bg__veil"></div>
        <div class="site-bg__paper"></div>
    </div>
</template>

<script setup>
import { onMounted, ref } from 'vue';
import siteBgUrl from '../../images/20260520-173230.png';

const loaded = ref(false);

function markLoaded() {
    loaded.value = true;
}

onMounted(() => {
    const img = new Image();
    img.src = siteBgUrl;
    if (img.complete) {
        markLoaded();
        return;
    }
    img.onload = markLoaded;
    img.onerror = markLoaded;
});
</script>
