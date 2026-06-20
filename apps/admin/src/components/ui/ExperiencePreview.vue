<template>
  <section class="ux-grid">
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>加载状态</strong>
        <StatusChip tone="blue">Skeleton</StatusChip>
      </div>
      <AppState
        compact
        type="loading"
        title="正在加载数据"
        description="列表、抽屉和表单加载时使用轻量状态，不长时间遮挡主界面。"
      />
    </div>
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>空状态</strong>
        <StatusChip tone="neutral">Empty</StatusChip>
      </div>
      <AppState
        compact
        title="暂无业务记录"
        description="完成接口接入后将在这里显示真实数据，可保留主操作入口。"
        primary-label="新建记录"
      />
    </div>
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>错误状态</strong>
        <StatusChip tone="red">Error</StatusChip>
      </div>
      <AppState
        compact
        type="error"
        title="接口暂时不可用"
        description="展示明确原因和重试入口，不使用默认 Alert 视觉。"
        primary-label="重新加载"
        primary-variant="danger"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import AppState from '@/components/ui/AppState.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
</script>
