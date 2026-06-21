<template>
  <div class="account-drawer-summary">
    <div class="account-drawer-summary__main">
      <span>{{ label }}</span>
      <strong>{{ appleId }}</strong>
      <p>
        {{ regionCurrency }}
        <template v-if="sourcePlatform"> / {{ sourcePlatform }}</template>
      </p>
    </div>

    <div class="account-drawer-summary__metrics">
      <div>
        <span>余额</span>
        <strong>{{ balance }}</strong>
      </div>
      <div>
        <span>均价</span>
        <strong>{{ averageCost }}</strong>
      </div>
    </div>

    <div class="account-drawer-summary__status">
      <StatusChip :tone="statusTone" dot>{{ statusLabel }}</StatusChip>
      <StatusChip :tone="locked ? 'red' : 'green'" dot>
        {{ locked ? '已锁定' : '未锁定' }}
      </StatusChip>
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusChip from '@/components/ui/StatusChip.vue';

withDefaults(
  defineProps<{
    label?: string;
    appleId: string;
    regionCurrency: string;
    balance: string;
    averageCost: string;
    statusLabel: string;
    statusTone: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'neutral';
    locked: boolean;
    sourcePlatform?: string | null;
  }>(),
  {
    label: '当前账号',
    sourcePlatform: ''
  }
);
</script>
