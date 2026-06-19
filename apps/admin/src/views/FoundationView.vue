<template>
  <main class="foundation-page">
    <section class="foundation-panel">
      <p class="eyebrow">Phase 0</p>
      <h1>后台管理系统工程骨架</h1>
      <p class="summary">
        当前只完成基础项目结构，尚未开发 Apple ID、兑换码、订单、权限等业务功能。
      </p>

      <el-divider />

      <el-descriptions :column="1" border>
        <el-descriptions-item label="后端">NestJS + Prisma</el-descriptions-item>
        <el-descriptions-item label="前端">Vue 3 + Vite + Element Plus</el-descriptions-item>
        <el-descriptions-item label="基础设施">PostgreSQL + Redis + MinIO</el-descriptions-item>
      </el-descriptions>
    </section>
  </main>
</template>
