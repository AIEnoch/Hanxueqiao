<template>
    <div>
        <SiteBackground />
        <SiteHeader />
        <RouterView />
        <SiteFooter :is-home="isHome" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import SiteBackground from './components/SiteBackground.vue';
import SiteHeader from './components/SiteHeader.vue';
import SiteFooter from './components/SiteFooter.vue';

const route = useRoute();
const isHome = computed(() => route.path === '/' || route.path === '/index.html');
</script>
