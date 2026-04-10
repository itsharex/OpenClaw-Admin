<template>
  <div class="progress-chart">
    <div class="progress-header">
      <NText strong>{{ title }}</NText>
      <NText depth="3">{{ percentage }}%</NText>
    </div>
    
    <div class="progress-bar">
      <div 
        class="progress-fill" 
        :style="{ width: `${percentage}%`, background: progressColor }"
      >
        <div class="progress-shimmer" v-if="shimmer"></div>
      </div>
    </div>
    
    <div class="progress-labels">
      <NText depth="3">{{ minLabel }}</NText>
      <NText depth="3">{{ maxLabel }}</NText>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { NText } from 'naive-ui'

const props = defineProps<{
  title: string
  value: number
  min?: number
  max?: number
  minLabel?: string
  maxLabel?: string
  shimmer?: boolean
}>()

const percentage = computed(() => {
  const min = props.min || 0
  const max = props.max || 100
  const clamped = Math.max(min, Math.min(max, props.value))
  return Math.round(((clamped - min) / (max - min)) * 100)
})

const progressColor = computed(() => {
  const pct = percentage.value
  if (pct < 30) return '#ff4d4f'
  if (pct < 70) return '#faad14'
  return '#52c41a'
})
</script>

<style scoped>
.progress-chart {
  padding: 16px;
  background: var(--n-color);
  border-radius: 8px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-bar {
  height: 12px;
  background: var(--n-color-embedded);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  transition: width 0.6s ease;
  position: relative;
}

.progress-shimmer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.3),
    transparent
  );
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
}
</style>
