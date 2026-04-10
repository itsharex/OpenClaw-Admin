<template>
  <div class="dashboard-card">
    <div class="card-header">
      <NText strong>{{ title }}</NText>
      <NButton v-if="showRefresh" size="small" @click="handleRefresh">
        <template #icon>
          <NIcon><RefreshOutline /></NIcon>
        </template>
      </NButton>
    </div>
    
    <div class="card-body">
      <div v-if="loading" class="loading">
        <NSpin size="medium" />
      </div>
      
      <div v-else-if="error" class="error">
        <NAlert type="error" :title="t('common.error')">
          {{ error }}
        </NAlert>
      </div>
      
      <div v-else class="content">
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue'
import { NText, NButton, NIcon, NSpin, NAlert } from 'naive-ui'
import { RefreshOutline } from '@vicons/ionicons5'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps<{
  title: string
  showRefresh?: boolean
  loading?: boolean
  error?: string | null
}>()

const emit = defineEmits<{
  (e: 'refresh'): void
}>()

function handleRefresh(): void {
  emit('refresh')
}
</script>

<style scoped>
.dashboard-card {
  background: var(--n-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-color-embedded);
}

.card-body {
  min-height: 200px;
}

.loading, .error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
}

.content {
  height: 100%;
}
</style>
