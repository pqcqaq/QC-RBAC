<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';

const props = defineProps<{
  code: string;
  label?: string;
}>();

const renderedSvg = ref('');
const errorMessage = ref('');
const pending = ref(true);

let ready = false;
let renderCount = 0;

const renderDiagram = async () => {
  if (typeof window === 'undefined') {
    return;
  }

  pending.value = true;
  errorMessage.value = '';

  try {
    const mermaidModule = await import('mermaid');
    const mermaid = mermaidModule.default;

    mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'loose',
      fontFamily: '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", sans-serif',
      themeVariables: {
        primaryColor: '#e4efe8',
        primaryTextColor: '#1a342c',
        primaryBorderColor: '#255747',
        lineColor: '#255747',
        secondaryColor: '#f1e4cb',
        tertiaryColor: '#f6efe3',
        clusterBkg: '#ece2d2',
        clusterBorder: '#a27b3e',
        noteBkgColor: '#fbf4e8',
        noteTextColor: '#5c4930',
      },
    });

    renderCount += 1;
    const { svg } = await mermaid.render(`rbac-docs-mermaid-${renderCount}`, props.code.trim());
    renderedSvg.value = svg;
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : 'Failed to render Mermaid diagram.';
  } finally {
    pending.value = false;
  }
};

onMounted(() => {
  ready = true;
  void renderDiagram();
});

watch(
  () => props.code,
  () => {
    if (ready) {
      void renderDiagram();
    }
  },
);
</script>

<template>
  <figure class="mermaid-figure">
    <figcaption v-if="label" class="mermaid-caption">{{ label }}</figcaption>
    <div v-if="pending" class="mermaid-state">Rendering diagram...</div>
    <div v-else-if="errorMessage" class="mermaid-state mermaid-state--error">{{ errorMessage }}</div>
    <div v-else class="mermaid-surface" v-html="renderedSvg" />
  </figure>
</template>

<style scoped>
.mermaid-figure {
  margin: 1.5rem 0;
}

.mermaid-caption {
  margin-bottom: 0.65rem;
  color: var(--vp-c-text-2);
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.mermaid-state,
.mermaid-surface {
  border: 1px solid rgba(43, 74, 63, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(249, 244, 236, 0.96)),
    linear-gradient(135deg, rgba(21, 94, 73, 0.04), rgba(196, 149, 73, 0.08));
  border-radius: 18px;
  box-shadow: 0 22px 54px rgba(35, 52, 44, 0.08);
}

.mermaid-state {
  padding: 1rem 1.15rem;
  color: var(--vp-c-text-2);
}

.mermaid-state--error {
  color: #a1402f;
}

.mermaid-surface {
  overflow-x: auto;
  padding: 1rem;
}

.mermaid-surface :deep(svg) {
  display: block;
  min-width: 680px;
  height: auto;
}

@media (max-width: 768px) {
  .mermaid-surface :deep(svg) {
    min-width: 560px;
  }
}
</style>
