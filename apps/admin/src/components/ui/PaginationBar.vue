<template>
  <nav class="pagination-row" aria-label="分页导航">
    <div class="pagination-row__summary" aria-live="polite">
      <strong :title="`共 ${total} 条`">{{ total }}</strong>
      <span v-if="total > 0">第 {{ rangeStart }}-{{ rangeEnd }} 条</span>
      <span v-else>暂无数据</span>
      <span class="pagination-row__page-status">第 {{ currentPage }} / {{ totalPages }} 页</span>
    </div>

    <div class="pagination-row__controls">
      <AppButton
        class="pagination-row__edge"
        icon-only
        size="small"
        title="第一页"
        aria-label="第一页"
        :disabled="isFirstPage"
        @click="goToFirstPage"
      >
        <el-icon>
          <DArrowLeft />
        </el-icon>
      </AppButton>

      <el-pagination
        :current-page="currentPage"
        :page-size="pageSize"
        :page-sizes="pageSizes"
        :pager-count="pagerCount"
        :total="total"
        :disabled="total <= 0"
        layout="sizes, prev, pager, next"
        @current-change="handlePageChange"
        @size-change="handleSizeChange"
      />

      <AppButton
        class="pagination-row__edge"
        icon-only
        size="small"
        title="最后一页"
        aria-label="最后一页"
        :disabled="isLastPage"
        @click="goToLastPage"
      >
        <el-icon>
          <DArrowRight />
        </el-icon>
      </AppButton>
    </div>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DArrowLeft, DArrowRight } from '@element-plus/icons-vue';
import AppButton from '@/components/ui/AppButton.vue';

const props = withDefaults(
  defineProps<{
    page: number;
    pageSize: number;
    total: number;
    pageSizes?: number[];
    pagerCount?: number;
  }>(),
  {
    pageSizes: () => [10, 20, 50, 100],
    pagerCount: 5
  }
);

const emit = defineEmits<{
  'update:page': [value: number];
  'update:pageSize': [value: number];
  'page-change': [value: number];
  'page-size-change': [value: number];
  change: [];
}>();

const safePageSize = computed(() => Math.max(1, props.pageSize));
const totalPages = computed(() => Math.max(1, Math.ceil(props.total / safePageSize.value)));
const currentPage = computed(() => clampPage(props.page));
const rangeStart = computed(() =>
  props.total > 0 ? (currentPage.value - 1) * safePageSize.value + 1 : 0
);
const rangeEnd = computed(() => Math.min(currentPage.value * safePageSize.value, props.total));
const isFirstPage = computed(() => currentPage.value <= 1);
const isLastPage = computed(() => currentPage.value >= totalPages.value);

function handlePageChange(value: number) {
  updatePage(value);
}

function handleSizeChange(value: number) {
  emit('update:pageSize', value);
  emit('page-size-change', value);

  const nextTotalPages = Math.max(1, Math.ceil(props.total / value));

  if (props.page > nextTotalPages) {
    emit('update:page', nextTotalPages);
    emit('page-change', nextTotalPages);
  }

  emit('change');
}

function goToFirstPage() {
  updatePage(1);
}

function goToLastPage() {
  updatePage(totalPages.value);
}

function updatePage(value: number) {
  const nextPage = clampPage(value);

  if (nextPage === currentPage.value) {
    return;
  }

  emit('update:page', nextPage);
  emit('page-change', nextPage);
  emit('change');
}

function clampPage(value: number) {
  return Math.min(Math.max(1, value), totalPages.value);
}
</script>
