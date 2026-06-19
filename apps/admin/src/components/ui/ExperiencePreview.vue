<template>
  <section class="ux-grid">
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>加载状态</strong>
        <el-tag size="small" type="info">Skeleton</el-tag>
      </div>
      <el-skeleton :rows="3" animated />
    </div>
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>空状态</strong>
        <el-tag size="small">Empty</el-tag>
      </div>
      <el-empty description="暂无数据，完成接口接入后将在这里显示业务记录" :image-size="72" />
    </div>
    <div class="ux-card">
      <div class="ux-card__head">
        <strong>错误状态</strong>
        <el-tag size="small" type="danger">Error</el-tag>
      </div>
      <el-alert
        title="接口暂未接入"
        description="页面设计已完成，后续开发真实接口时展示重试、错误详情和联系技术入口。"
        type="error"
        show-icon
        :closable="false"
      />
    </div>
  </section>
</template>
