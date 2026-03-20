<template>
  <PageScaffold :stats="summary.metrics">
    <template #actions>
      <el-button @click="loadSummary">刷新总览</el-button>
    </template>

    <div class="metrics-grid" v-loading="loading">
      <MetricCard
        v-for="metric in summary.metrics"
        :key="metric.label"
        :label="metric.label"
        :value="metric.value"
        :trend="metric.trend"
      />
    </div>

    <div class="split-grid">
      <SurfacePanel caption="Role Mix" title="角色负载分布">
        <div>
          <div v-for="item in summary.roleDistribution" :key="item.roleName" class="chart-row">
            <strong>{{ item.roleName }}</strong>
            <progress :value="item.count" :max="maxRoleCount"></progress>
            <span>{{ item.count }}</span>
          </div>
        </div>
      </SurfacePanel>

      <SurfacePanel caption="Module Coverage" title="权限模块覆盖">
        <div>
          <div v-for="item in summary.moduleCoverage" :key="item.module" class="chart-row">
            <strong>{{ item.module }}</strong>
            <span>{{ item.count }} 项权限</span>
          </div>
        </div>
      </SurfacePanel>
    </div>

    <div class="split-grid">
      <SurfacePanel caption="Recent Members" title="新加入用户">
        <div v-if="summary.latestUsers.length">
          <div v-for="user in summary.latestUsers" :key="user.id" class="audit-row">
            <div>
              <strong>{{ user.nickname }}</strong>
              <span class="muted">{{ user.email }}</span>
            </div>
            <div class="role-pill-row">
              <span v-for="role in user.roles" :key="role.id" class="role-pill">{{ role.name }}</span>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无用户数据" />
      </SurfacePanel>

      <SurfacePanel caption="Audit Feed" title="最近审计动作">
        <div v-if="summary.auditFeed.length">
          <div v-for="log in summary.auditFeed" :key="log.id" class="audit-row">
            <div>
              <strong>{{ log.action }}</strong>
              <span class="muted">{{ log.actor }} -> {{ log.target }}</span>
            </div>
            <small class="muted">{{ formatTime(log.createdAt) }}</small>
          </div>
        </div>
        <el-empty v-else description="暂无审计数据" />
      </SurfacePanel>
    </div>
  </PageScaffold>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import type { DashboardSummary } from '@rbac/api-common';
import MetricCard from '@/components/MetricCard.vue';
import PageScaffold from '@/components/workbench/PageScaffold.vue';
import SurfacePanel from '@/components/workbench/SurfacePanel.vue';
import { api } from '@/api/client';

defineOptions({ name: 'DashboardView' });

const summary = reactive<DashboardSummary>({
  metrics: [],
  roleDistribution: [],
  moduleCoverage: [],
  latestUsers: [],
  auditFeed: [],
});
const loading = ref(false);

const formatTime = (value: string) => new Date(value).toLocaleString();
const maxRoleCount = computed(() => Math.max(...summary.roleDistribution.map((item) => item.count), 1));

const loadSummary = async () => {
  loading.value = true;
  try {
    Object.assign(summary, await api.dashboard.summary());
  } finally {
    loading.value = false;
  }
};

onMounted(loadSummary);
</script>
