<template>
  <div class="app-shell">
    <aside class="app-sidebar" :class="{ 'app-sidebar--open': sidebarOpen }">
      <div class="brand">
        <span class="brand-mark">ID</span>
        <span class="brand-copy">
          <strong>代充业务控制台</strong>
          <small>Apple ID · 自动发货</small>
        </span>
      </div>

      <el-input v-model="menuKeyword" class="menu-search" placeholder="搜索菜单 / 页面" clearable />

      <nav class="sidebar-nav">
        <section v-for="section in filteredSections" :key="section.title" class="nav-section">
          <p>{{ section.title }}</p>
          <RouterLink
            v-for="item in section.items"
            :key="item.key"
            :to="item.route"
            class="nav-link"
            :class="{ active: activePath === item.route }"
            @click="sidebarOpen = false"
          >
            <span class="nav-mark">{{ item.mark }}</span>
            <span class="nav-title">{{ item.title }}</span>
            <el-tag v-if="item.badge" size="small" effect="dark">{{ item.badge }}</el-tag>
          </RouterLink>
        </section>
      </nav>

      <div class="sidebar-operator">
        <span class="avatar">管</span>
        <span>
          <strong>{{ authStore.displayName }}</strong>
          <small>在线 · 本地开发</small>
        </span>
      </div>
    </aside>

    <div v-if="sidebarOpen" class="sidebar-mask" @click="sidebarOpen = false" />

    <section class="app-main">
      <header class="topbar">
        <el-button class="mobile-menu-btn" @click="sidebarOpen = true">菜单</el-button>
        <div class="page-head">
          <small>{{ routeGroup }}</small>
          <h2>{{ routeTitle }}</h2>
        </div>

        <el-popover placement="bottom-start" width="420" trigger="focus">
          <template #reference>
            <el-input
              v-model="globalKeyword"
              class="global-search"
              placeholder="搜索客户微信、Apple ID、订单号、兑换码尾号、任务备注"
              clearable
            />
          </template>
          <div class="global-search-panel">
            <strong>全局搜索预览</strong>
            <p>设计已预留入口，后续接入客户、订单、Apple ID、兑换码和任务搜索。</p>
            <el-empty v-if="!globalKeyword" description="输入关键词后显示结果" :image-size="64" />
            <el-alert v-else title="接口待接入" type="info" show-icon :closable="false" />
          </div>
        </el-popover>

        <div class="topbar-actions">
          <el-button @click="showRefresh">刷新</el-button>
          <el-badge value="6" class="notification-badge">
            <el-button @click="notificationDrawerVisible = true">通知</el-button>
          </el-badge>

          <el-dropdown trigger="click" @command="handleCommand">
            <el-button>
              {{ authStore.displayName }}
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="security">安全中心</el-dropdown-item>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </header>

      <main class="workspace">
        <RouterView />
      </main>
    </section>

    <AppDrawer v-model="notificationDrawerVisible" title="通知中心预览" confirm-text="进入通知中心">
      <div class="mini-list">
        <div class="mini-row">
          <span>Apple ID 余额不足</span>
          <el-tag type="warning" size="small">重要</el-tag>
        </div>
        <div class="mini-row">
          <span>兑换码低库存</span>
          <el-tag type="danger" size="small">紧急</el-tag>
        </div>
        <div class="mini-row">
          <span>平台接口异常</span>
          <el-tag type="info" size="small">待处理</el-tag>
        </div>
      </div>
    </AppDrawer>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import { menuSections } from '@/config/modules';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const sidebarOpen = ref(false);
const menuKeyword = ref('');
const globalKeyword = ref('');
const notificationDrawerVisible = ref(false);

const activePath = computed(() => route.path);
const routeTitle = computed(() => String(route.meta.title ?? '后台管理'));
const routeGroup = computed(() => String(route.meta.group ?? '控制台'));

const filteredSections = computed(() => {
  const keyword = menuKeyword.value.trim().toLowerCase();

  if (!keyword) {
    return menuSections;
  }

  return menuSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        return `${item.title} ${item.group} ${item.phase}`.toLowerCase().includes(keyword);
      })
    }))
    .filter((section) => section.items.length);
});

function showRefresh() {
  ElMessage.success('页面状态已刷新');
}

async function handleCommand(command: string) {
  if (command === 'logout') {
    await authStore.logout();
    await router.push('/login');
    return;
  }

  if (command === 'security') {
    await router.push('/system/security');
  }
}
</script>
