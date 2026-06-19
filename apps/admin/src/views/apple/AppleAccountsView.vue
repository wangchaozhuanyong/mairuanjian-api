<template>
  <PageScaffold
    title="Apple ID 管理"
    group="Apple ID 业务"
    phase="Phase 3"
    description="管理 Apple ID 基础资料、余额、余额人民币成本、移动加权平均成本、状态和手动锁定。敏感字段加密保存，列表默认脱敏。"
  >
    <template #actions>
      <el-button @click="openImport">批量导入</el-button>
    </template>

    <div class="metric-grid metric-grid--four">
      <MetricCard label="账号数量" :value="total" hint="当前筛选结果" tone="blue" />
      <MetricCard label="总余额" :value="totalBalance" hint="按当前页合计" tone="green" />
      <MetricCard label="余额成本" :value="totalCost" hint="人民币成本，当前页合计" tone="orange" />
      <MetricCard label="锁定账号" :value="lockedCount" hint="当前页手动锁定" tone="red" />
    </div>

    <section class="content-panel">
      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:density="density"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="accountColumnOptions"
        :status-options="accountStatusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedAccounts.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增 Apple ID"
        placeholder="搜索 Apple ID、地区、币种、备注"
        @search="applyFilters"
        @refresh="loadAccounts"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-input
            v-model.trim="query.region"
            class="table-toolbar__select"
            placeholder="地区"
            clearable
            @keyup.enter="applyFilters"
            @clear="applyFilters"
          />
          <el-input
            v-model.trim="query.currency"
            class="table-toolbar__select"
            placeholder="币种"
            clearable
            @keyup.enter="applyFilters"
            @clear="applyFilters"
          />
          <el-select
            v-model="query.locked"
            class="table-toolbar__select"
            clearable
            placeholder="手动锁定"
            @change="applyFilters"
          >
            <el-option label="已锁定" value="true" />
            <el-option label="未锁定" value="false" />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        :data="accounts"
        :size="tableSize"
        row-key="id"
        empty-text="暂无 Apple ID"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('appleId')"
          prop="appleId"
          label="Apple ID"
          min-width="190"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.appleIdMasked }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('region')"
          prop="region"
          label="地区/币种"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">{{ row.region }} / {{ row.currency }}</template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('currentBalance')"
          prop="currentBalance"
          label="余额"
          width="120"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('balanceCostAmount')"
          prop="balanceCostAmount"
          label="余额成本"
          width="130"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('averageCost')"
          prop="averageCost"
          label="平均成本"
          width="130"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="130"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)" size="small" effect="light">
              {{ getStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('secrets')" label="敏感资料" min-width="180">
          <template #default="{ row }">
            <el-tag v-if="row.hasPassword" class="tag-gap" size="small">密码</el-tag>
            <el-tag v-if="row.hasSecurityInfo" class="tag-gap" size="small">密保</el-tag>
            <el-tag v-if="row.hasPhone" class="tag-gap" size="small">手机</el-tag>
            <el-tag v-if="row.hasRecoveryEmail" class="tag-gap" size="small">备用邮箱</el-tag>
            <span
              v-if="
                !row.hasPassword && !row.hasSecurityInfo && !row.hasPhone && !row.hasRecoveryEmail
              "
              >-</span
            >
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('isManuallyLocked')"
          prop="isManuallyLocked"
          label="锁定"
          width="100"
          sortable="custom"
        >
          <template #default="{ row }">
            <el-tag :type="row.isManuallyLocked ? 'danger' : 'success'" size="small">
              {{ row.isManuallyLocked ? '已锁定' : '正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('updatedAt')"
          prop="updatedAt"
          label="更新时间"
          min-width="170"
          sortable="custom"
        >
          <template #default="{ row }">{{ formatDate(row.updatedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="350" fixed="right">
          <template #default="{ row }">
            <el-button text type="primary" @click="openDetail(row)">详情</el-button>
            <el-button text type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button text type="primary" @click="openAccountSecret(row)">敏感</el-button>
            <el-button text type="primary" @click="openStatusCheck(row)">检测</el-button>
            <el-button text type="primary" @click="openTopup(row)">充值</el-button>
            <el-button text @click="openConsumption(row)">消费</el-button>
            <el-button text @click="openRecords(row)">流水</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-row">
        <el-pagination
          v-model:current-page="query.page"
          v-model:page-size="query.pageSize"
          :total="total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @current-change="loadAccounts"
          @size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingAccount ? '编辑 Apple ID' : '新增 Apple ID'"
      width="720px"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-alert
          title="敏感字段会加密保存"
          description="密码、密保、手机号、备用邮箱不会明文返回前端；编辑时留空表示不修改。"
          type="info"
          show-icon
          :closable="false"
        />
        <el-form-item v-if="!editingAccount" label="Apple ID" prop="appleId">
          <el-input v-model.trim="form.appleId" placeholder="example@icloud.com" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item label="地区" prop="region">
            <el-input v-model.trim="form.region" placeholder="US" />
          </el-form-item>
          <el-form-item label="币种" prop="currency">
            <el-input v-model.trim="form.currency" placeholder="USD" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="当前余额" prop="currentBalance">
            <el-input v-model.trim="form.currentBalance" />
          </el-form-item>
          <el-form-item label="余额人民币成本" prop="balanceCostAmount">
            <el-input v-model.trim="form.balanceCostAmount" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item label="状态">
            <el-select v-model="form.status" class="full-input">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="手动锁定">
            <el-switch v-model="form.isManuallyLocked" active-text="锁定" inactive-text="正常" />
          </el-form-item>
        </div>
        <el-form-item v-if="form.isManuallyLocked" label="锁定原因">
          <el-input v-model="form.manualLockReason" type="textarea" :rows="2" />
        </el-form-item>
        <div class="form-grid">
          <el-form-item :label="editingAccount ? '密码（留空不修改）' : '密码'">
            <el-input v-model="form.password" type="password" show-password />
          </el-form-item>
          <el-form-item :label="editingAccount ? '绑定手机号（留空不修改）' : '绑定手机号'">
            <el-input v-model.trim="form.phone" />
          </el-form-item>
        </div>
        <el-form-item :label="editingAccount ? '备用邮箱（留空不修改）' : '备用邮箱'">
          <el-input v-model.trim="form.recoveryEmail" />
        </el-form-item>
        <el-form-item :label="editingAccount ? '密保信息（留空不修改）' : '密保信息'">
          <el-input v-model="form.securityInfo" type="textarea" :rows="3" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveAccount">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="importDialogVisible" title="批量导入 Apple ID" width="820px">
      <el-form ref="importFormRef" :model="importForm" :rules="importRules" label-position="top">
        <el-alert
          title="导入字段会按现有规则校验和加密"
          description="密码、手机号、备用邮箱会加密保存；导入结果会逐行返回成功和失败原因。"
          type="info"
          show-icon
          :closable="false"
        />
        <el-form-item label="导入内容" prop="accountsText">
          <el-input
            v-model="importForm.accountsText"
            type="textarea"
            :rows="10"
            placeholder="支持逗号或制表符分隔，可带表头。字段顺序：appleId,password,region,currency,currentBalance,balanceCostAmount,phone,recoveryEmail,remark"
          />
        </el-form-item>
      </el-form>

      <el-alert
        v-if="importResult"
        class="result-alert"
        :title="`导入完成：成功 ${importResult.successCount} 条，失败 ${importResult.failedCount} 条`"
        :type="importResult.failedCount ? 'warning' : 'success'"
        show-icon
        :closable="false"
      />
      <el-table
        v-if="importResult?.errors.length"
        class="result-table"
        :data="importResult.errors"
        max-height="220"
      >
        <el-table-column prop="rowNo" label="行号" width="90" />
        <el-table-column prop="appleId" label="Apple ID" width="180">
          <template #default="{ row }">{{ row.appleId ?? '-' }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="失败原因" />
      </el-table>

      <template #footer>
        <el-button @click="importDialogVisible = false">关闭</el-button>
        <el-button type="primary" :loading="importing" @click="submitImport">开始导入</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="topupDialogVisible"
      :title="`录入充值 · ${selectedAccount?.appleIdMasked ?? ''}`"
      width="620px"
    >
      <el-form ref="topupFormRef" :model="topupForm" :rules="topupRules" label-position="top">
        <div class="form-grid">
          <el-form-item label="充值面值" prop="faceValue">
            <el-input v-model.trim="topupForm.faceValue" />
          </el-form-item>
          <el-form-item label="本次人民币成本" prop="costAmount">
            <el-input v-model.trim="topupForm.costAmount" />
          </el-form-item>
        </div>
        <el-form-item label="礼品卡代码 / 充值代码">
          <el-input
            v-model.trim="topupForm.giftCardCode"
            type="password"
            show-password
            placeholder="完整代码加密保存，列表只显示后4位"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="topupForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="topupDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBalanceRecord" @click="saveTopup"
          >保存充值</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="consumptionDialogVisible"
      :title="`录入消费 · ${selectedAccount?.appleIdMasked ?? ''}`"
      width="620px"
    >
      <el-form
        ref="consumptionFormRef"
        :model="consumptionForm"
        :rules="consumptionRules"
        label-position="top"
      >
        <el-form-item label="消费金额" prop="amount">
          <el-input v-model.trim="consumptionForm.amount" />
        </el-form-item>
        <el-form-item label="消费原因">
          <el-input
            v-model.trim="consumptionForm.reason"
            placeholder="例如 手工开通 / 测试扣费 / 余额修正"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="consumptionForm.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="consumptionDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingBalanceRecord" @click="saveConsumption"
          >保存消费</el-button
        >
      </template>
    </el-dialog>

    <el-dialog
      v-model="statusCheckDialogVisible"
      :title="`录入状态检测 · ${selectedAccount?.appleIdMasked ?? ''}`"
      width="620px"
    >
      <el-form
        ref="statusCheckFormRef"
        :model="statusCheckForm"
        :rules="statusCheckRules"
        label-position="top"
      >
        <div class="form-grid">
          <el-form-item label="检测结果" prop="resultStatus">
            <el-select v-model="statusCheckForm.resultStatus" class="full-input">
              <el-option
                v-for="item in statusOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="余额快照">
            <el-input v-model.trim="statusCheckForm.balanceSnapshot" placeholder="可选" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input
            v-model="statusCheckForm.remark"
            type="textarea"
            :rows="3"
            placeholder="例如 人工登录正常 / 需要短信验证 / 密码错误"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="statusCheckDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingStatusCheck" @click="saveStatusCheck">
          保存检测
        </el-button>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="recordsDrawerVisible"
      :title="`余额流水 · ${selectedAccount?.appleIdMasked ?? ''}`"
      confirm-text="刷新流水"
      @confirm="loadBalanceRecords"
    >
      <div class="drawer-detail-grid">
        <div>
          <span>当前余额</span>
          <strong>{{ selectedAccount?.currentBalance ?? '-' }}</strong>
        </div>
        <div>
          <span>余额成本</span>
          <strong>{{ selectedAccount?.balanceCostAmount ?? '-' }}</strong>
        </div>
        <div>
          <span>平均成本</span>
          <strong>{{ selectedAccount?.averageCost ?? '-' }}</strong>
        </div>
      </div>

      <el-tabs class="balance-record-tabs">
        <el-tab-pane label="充值记录">
          <el-table v-loading="recordsLoading" :data="topups" size="small" row-key="id">
            <el-table-column prop="faceValue" label="面值" width="90" />
            <el-table-column prop="costAmount" label="成本" width="90" />
            <el-table-column prop="avgCostAfter" label="充值后均价" width="120" />
            <el-table-column label="礼品卡代码" width="190">
              <template #default="{ row }">
                <div v-if="row.hasGiftCardCode" class="inline-actions">
                  <el-tag size="small" effect="light"
                    >尾号 {{ row.giftCardCodeTail ?? '-' }}</el-tag
                  >
                  <el-button
                    v-if="canRevealGiftCardCode"
                    text
                    type="primary"
                    size="small"
                    @click="openGiftCodeDialog(row)"
                    >查看完整</el-button
                  >
                </div>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="createdAt" label="时间" min-width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="消费记录">
          <el-table v-loading="recordsLoading" :data="consumptions" size="small" row-key="id">
            <el-table-column prop="amount" label="消费" width="90" />
            <el-table-column prop="costAmount" label="成本" width="90" />
            <el-table-column prop="avgUnitCost" label="消费均价" width="110" />
            <el-table-column prop="balanceAfter" label="消费后余额" width="120" />
            <el-table-column prop="createdAt" label="时间" min-width="160">
              <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </AppDrawer>

    <el-dialog
      v-model="accountSecretDialogVisible"
      title="查看 Apple ID 敏感资料"
      width="560px"
      @closed="resetAccountSecretDialog"
    >
      <el-alert
        title="敏感字段查看会写入审计日志"
        description="完整资料只用于必要的业务核对，不会出现在列表、导出和操作日志明文中。"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-form
        ref="accountSecretFormRef"
        class="sensitive-form"
        :model="accountSecretForm"
        :rules="accountSecretRules"
        label-position="top"
      >
        <el-form-item label="Apple ID">
          <el-input :model-value="selectedAccount?.appleIdMasked ?? '-'" disabled />
        </el-form-item>
        <el-form-item label="字段" prop="field">
          <el-select
            v-model="accountSecretForm.field"
            class="full-input"
            @change="accountSecretForm.value = ''"
          >
            <el-option
              v-for="item in accountSecretOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="accountSecretForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后登录核对 / 客户资料变更 / 安全验证"
          />
        </el-form-item>
        <el-form-item v-if="accountSecretForm.value" :label="accountSecretFieldLabel">
          <el-input v-model="accountSecretForm.value" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="accountSecretDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="revealingAccountSecret" @click="revealAccountSecret">
          查看完整资料
        </el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="giftCodeDialogVisible"
      title="查看完整礼品卡代码"
      width="560px"
      @closed="resetGiftCodeDialog"
    >
      <el-alert
        title="敏感字段查看会写入审计日志"
        description="完整代码只用于核对充值记录，不会出现在列表、导出和操作日志明文中。"
        type="warning"
        show-icon
        :closable="false"
      />
      <el-form
        ref="giftCodeFormRef"
        class="sensitive-form"
        :model="giftCodeForm"
        :rules="giftCodeRules"
        label-position="top"
      >
        <el-form-item label="充值记录">
          <el-input :model-value="giftCodeRecordLabel" disabled />
        </el-form-item>
        <el-form-item label="查看原因" prop="reason">
          <el-input
            v-model.trim="giftCodeForm.reason"
            type="textarea"
            :rows="3"
            placeholder="例如 售后核对 / 财务对账 / 重复充值排查"
          />
        </el-form-item>
        <el-form-item v-if="giftCodeForm.code" label="完整礼品卡代码">
          <el-input v-model="giftCodeForm.code" type="textarea" :rows="3" readonly />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="giftCodeDialogVisible = false">关闭</el-button>
        <el-button type="warning" :loading="revealingGiftCode" @click="revealGiftCardCode">
          查看完整代码
        </el-button>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { appleAccountsApi, userTableViewsApi } from '@/api/system';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import MetricCard from '@/components/ui/MetricCard.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { useAuthStore } from '@/stores/auth';
import type {
  AppleAccount,
  AppleAccountImportResult,
  AppleAccountSecretField,
  AppleBalanceConsumption,
  AppleBalanceTopup,
  TableDensity,
  UserTableView
} from '@/types/system';

const statusOptions: Array<{
  label: string;
  value: AppleAccount['status'];
  type: 'success' | 'warning' | 'danger' | 'info';
}> = [
  { label: '正常', value: 'normal', type: 'success' },
  { label: '需要验证', value: 'need_verify', type: 'warning' },
  { label: '已锁定', value: 'locked', type: 'danger' },
  { label: '密码错误', value: 'password_error', type: 'danger' },
  { label: '风险', value: 'risk', type: 'warning' },
  { label: '未知', value: 'unknown', type: 'info' }
];
const tableKey = 'apple_accounts';
const accountStatusOptions = statusOptions.map((item) => ({
  label: item.label,
  value: item.value
}));
const accountColumnOptions = [
  { label: 'Apple ID', value: 'appleId', required: true },
  { label: '地区/币种', value: 'region' },
  { label: '余额', value: 'currentBalance' },
  { label: '余额成本', value: 'balanceCostAmount' },
  { label: '平均成本', value: 'averageCost' },
  { label: '状态', value: 'status' },
  { label: '敏感资料', value: 'secrets' },
  { label: '锁定', value: 'isManuallyLocked' },
  { label: '更新时间', value: 'updatedAt' }
];
const lockedOptions = [
  { label: '已锁定', value: 'true' },
  { label: '未锁定', value: 'false' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const importing = ref(false);
const savingBalanceRecord = ref(false);
const savingStatusCheck = ref(false);
const revealingAccountSecret = ref(false);
const revealingGiftCode = ref(false);
const dialogVisible = ref(false);
const importDialogVisible = ref(false);
const topupDialogVisible = ref(false);
const consumptionDialogVisible = ref(false);
const statusCheckDialogVisible = ref(false);
const recordsDrawerVisible = ref(false);
const accountSecretDialogVisible = ref(false);
const giftCodeDialogVisible = ref(false);
const recordsLoading = ref(false);
const editingAccount = ref<AppleAccount | null>(null);
const selectedAccount = ref<AppleAccount | null>(null);
const selectedTopup = ref<AppleBalanceTopup | null>(null);
const formRef = ref<FormInstance>();
const importFormRef = ref<FormInstance>();
const topupFormRef = ref<FormInstance>();
const consumptionFormRef = ref<FormInstance>();
const statusCheckFormRef = ref<FormInstance>();
const accountSecretFormRef = ref<FormInstance>();
const giftCodeFormRef = ref<FormInstance>();
const accounts = ref<AppleAccount[]>([]);
const topups = ref<AppleBalanceTopup[]>([]);
const consumptions = ref<AppleBalanceConsumption[]>([]);
const importResult = ref<AppleAccountImportResult | null>(null);
const selectedAccounts = ref<AppleAccount[]>([]);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const total = ref(0);
const authStore = useAuthStore();
const router = useRouter();

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  region: '',
  currency: '',
  locked: '',
  sortBy: '',
  sortOrder: '' as '' | 'asc' | 'desc'
});

const form = reactive({
  appleId: '',
  region: 'US',
  currency: 'USD',
  currentBalance: '0',
  balanceCostAmount: '0',
  status: 'normal' as AppleAccount['status'],
  isManuallyLocked: false,
  manualLockReason: '',
  password: '',
  securityInfo: '',
  phone: '',
  recoveryEmail: '',
  remark: ''
});

const importForm = reactive({
  accountsText: ''
});

const topupForm = reactive({
  faceValue: '',
  costAmount: '',
  giftCardCode: '',
  remark: ''
});

const consumptionForm = reactive({
  amount: '',
  reason: '',
  remark: ''
});

const statusCheckForm = reactive({
  resultStatus: 'normal' as AppleAccount['status'],
  balanceSnapshot: '',
  remark: ''
});

const giftCodeForm = reactive({
  reason: '',
  code: ''
});

const accountSecretForm = reactive({
  field: 'appleId' as AppleAccountSecretField,
  reason: '',
  value: ''
});

const rules: FormRules<typeof form> = {
  appleId: [{ required: true, message: '请输入 Apple ID', trigger: 'blur' }],
  region: [{ required: true, message: '请输入地区', trigger: 'blur' }],
  currency: [{ required: true, message: '请输入币种', trigger: 'blur' }],
  currentBalance: [{ required: true, message: '请输入余额', trigger: 'blur' }],
  balanceCostAmount: [{ required: true, message: '请输入余额成本', trigger: 'blur' }]
};

const importRules: FormRules<typeof importForm> = {
  accountsText: [{ required: true, message: '请输入导入内容', trigger: 'blur' }]
};

const topupRules: FormRules<typeof topupForm> = {
  faceValue: [{ required: true, message: '请输入充值面值', trigger: 'blur' }],
  costAmount: [{ required: true, message: '请输入本次人民币成本', trigger: 'blur' }]
};

const consumptionRules: FormRules<typeof consumptionForm> = {
  amount: [{ required: true, message: '请输入消费金额', trigger: 'blur' }]
};

const statusCheckRules: FormRules<typeof statusCheckForm> = {
  resultStatus: [{ required: true, message: '请选择检测结果', trigger: 'change' }]
};

const giftCodeRules: FormRules<typeof giftCodeForm> = {
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const accountSecretRules: FormRules<typeof accountSecretForm> = {
  field: [{ required: true, message: '请选择字段', trigger: 'change' }],
  reason: [{ required: true, message: '请输入查看原因', trigger: 'blur' }]
};

const totalBalance = computed(() =>
  sumDecimal(accounts.value.map((account) => account.currentBalance))
);
const totalCost = computed(() =>
  sumDecimal(accounts.value.map((account) => account.balanceCostAmount))
);
const lockedCount = computed(
  () => accounts.value.filter((account) => account.isManuallyLocked).length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const lockedLabel = lockedOptions.find((item) => item.value === query.locked)?.label;

  if (query.region) {
    chips.push({ key: 'region', label: '地区', value: query.region });
  }

  if (query.currency) {
    chips.push({ key: 'currency', label: '币种', value: query.currency });
  }

  if (query.locked && lockedLabel) {
    chips.push({ key: 'locked', label: '手动锁定', value: lockedLabel });
  }

  return chips;
});
const canRevealGiftCardCode = computed(
  () =>
    authStore.user?.roles.includes('admin') ||
    authStore.user?.permissions.includes('apple.topup.gift_code.view_full')
);
const accountSecretOptions = computed(() =>
  selectedAccount.value ? getAccountSecretOptions(selectedAccount.value) : []
);
const accountSecretFieldLabel = computed(
  () =>
    accountSecretOptions.value.find((item) => item.value === accountSecretForm.field)?.label ??
    '完整资料'
);
const giftCodeRecordLabel = computed(() => {
  if (!selectedTopup.value) {
    return '-';
  }

  return `${formatDate(selectedTopup.value.createdAt)} / 面值 ${selectedTopup.value.faceValue} / 尾号 ${
    selectedTopup.value.giftCardCodeTail ?? '-'
  }`;
});

const accountSortFieldMap: Record<string, string> = {
  appleId: 'appleId',
  region: 'region',
  currentBalance: 'currentBalance',
  balanceCostAmount: 'balanceCostAmount',
  averageCost: 'averageCost',
  status: 'status',
  isManuallyLocked: 'isManuallyLocked',
  updatedAt: 'updatedAt'
};

function sumDecimal(values: string[]) {
  return values.reduce((sum, value) => sum + Number(value), 0).toFixed(2);
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getStatusLabel(status: AppleAccount['status']) {
  return statusOptions.find((item) => item.value === status)?.label ?? status;
}

function getStatusType(status: AppleAccount['status']) {
  return statusOptions.find((item) => item.value === status)?.type ?? 'info';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

async function loadAccounts() {
  loading.value = true;
  try {
    const data = await appleAccountsApi.list({
      page: query.page,
      pageSize: query.pageSize,
      keyword: query.keyword || undefined,
      status: query.status || undefined,
      region: query.region || undefined,
      currency: query.currency || undefined,
      locked: query.locked || undefined,
      sortBy: query.sortBy || undefined,
      sortOrder: query.sortOrder || undefined
    });
    accounts.value = data.items;
    total.value = data.total;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载 Apple ID 失败');
  } finally {
    loading.value = false;
  }
}

function applyFilters() {
  query.page = 1;
  loadAccounts();
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.region = '';
  query.currency = '';
  query.locked = '';
  query.sortBy = '';
  query.sortOrder = '';
  savedViewId.value = '';
}

function removeFilter(key: string) {
  if (key === 'region') {
    query.region = '';
  }
  if (key === 'currency') {
    query.currency = '';
  }
  if (key === 'locked') {
    query.locked = '';
  }
}

function handlePageSizeChange() {
  query.page = 1;
  loadAccounts();
}

function handleSortChange(event: { prop?: string; order?: 'ascending' | 'descending' | null }) {
  query.page = 1;
  query.sortBy = event.prop ? accountSortFieldMap[event.prop] || '' : '';
  query.sortOrder =
    event.order === 'ascending' ? 'asc' : event.order === 'descending' ? 'desc' : '';

  if (!query.sortOrder) {
    query.sortBy = '';
  }

  loadAccounts();
}

function handleSelectionChange(rows: AppleAccount[]) {
  selectedAccounts.value = rows;
}

function exportList() {
  ElMessage.info('Apple ID 列表导出会进入数据中心导出任务，后续统一接入');
}

function handleBatchAction(action: string) {
  if (action === 'export') {
    exportList();
  }
}

async function loadTableViews(applyDefault = false) {
  try {
    const data = await userTableViewsApi.list({
      page: 1,
      pageSize: 100,
      tableKey
    });
    savedViews.value = data.items;
    if (applyDefault) {
      const defaultView = data.items.find((view) => view.isDefault);
      if (defaultView) {
        applyView(defaultView);
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载保存视图失败');
  }
}

async function saveTableView() {
  try {
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存 Apple ID 列表视图', {
      inputValue: 'Apple ID 常用视图',
      inputPattern: /^.{1,60}$/,
      inputErrorMessage: '视图名称不能为空，且不超过 60 个字符',
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    });
    const created = await userTableViewsApi.create({
      tableKey,
      viewName: value.trim(),
      filters: {
        keyword: query.keyword,
        status: query.status,
        region: query.region,
        currency: query.currency,
        locked: query.locked
      },
      sortConfig: {
        prop: query.sortBy,
        order:
          query.sortOrder === 'asc' ? 'ascending' : query.sortOrder === 'desc' ? 'descending' : null
      },
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : accountColumnOptions.map((column) => column.value),
      density: density.value,
      pageSize: query.pageSize,
      isDefault: savedViews.value.length === 0
    });
    await loadTableViews();
    savedViewId.value = created.id;
    ElMessage.success('表格视图已保存');
  } catch (error) {
    if (error === 'cancel' || error === 'close') return;
    ElMessage.error(error instanceof Error ? error.message : '保存视图失败');
  }
}

async function applySavedView(id: string) {
  const view = savedViews.value.find((item) => item.id === id);
  if (!view) return;
  applyView(view);
  ElMessage.success('已应用保存视图');
  await loadAccounts();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = typeof filters.status === 'string' ? filters.status : '';
  query.region = typeof filters.region === 'string' ? filters.region : '';
  query.currency = typeof filters.currency === 'string' ? filters.currency : '';
  query.locked = typeof filters.locked === 'string' ? filters.locked : '';
  query.pageSize = view.pageSize;
  query.page = 1;
  density.value = view.density;
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        accountColumnOptions.some((option) => option.value === column)
      )
    : accountColumnOptions.map((column) => column.value);
  applySortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function applySortConfig(value: Record<string, unknown>) {
  const prop = typeof value.prop === 'string' ? value.prop : '';
  const order = value.order === 'ascending' ? 'asc' : value.order === 'descending' ? 'desc' : '';

  query.sortBy = accountSortFieldMap[prop] ?? prop;
  query.sortOrder = order;
}

function resetForm() {
  form.appleId = '';
  form.region = 'US';
  form.currency = 'USD';
  form.currentBalance = '0';
  form.balanceCostAmount = '0';
  form.status = 'normal';
  form.isManuallyLocked = false;
  form.manualLockReason = '';
  form.password = '';
  form.securityInfo = '';
  form.phone = '';
  form.recoveryEmail = '';
  form.remark = '';
}

function openCreate() {
  editingAccount.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openImport() {
  importForm.accountsText = '';
  importResult.value = null;
  importDialogVisible.value = true;
}

function openEdit(account: AppleAccount) {
  editingAccount.value = account;
  form.appleId = '';
  form.region = account.region;
  form.currency = account.currency;
  form.currentBalance = account.currentBalance;
  form.balanceCostAmount = account.balanceCostAmount;
  form.status = account.status;
  form.isManuallyLocked = account.isManuallyLocked;
  form.manualLockReason = account.manualLockReason ?? '';
  form.password = '';
  form.securityInfo = '';
  form.phone = '';
  form.recoveryEmail = '';
  form.remark = account.remark ?? '';
  dialogVisible.value = true;
}

function resetTopupForm() {
  topupForm.faceValue = '';
  topupForm.costAmount = '';
  topupForm.giftCardCode = '';
  topupForm.remark = '';
}

function resetConsumptionForm() {
  consumptionForm.amount = '';
  consumptionForm.reason = '';
  consumptionForm.remark = '';
}

function resetStatusCheckForm(account?: AppleAccount) {
  statusCheckForm.resultStatus = account?.status ?? 'normal';
  statusCheckForm.balanceSnapshot = account?.currentBalance ?? '';
  statusCheckForm.remark = '';
}

function resetGiftCodeDialog() {
  selectedTopup.value = null;
  giftCodeForm.reason = '';
  giftCodeForm.code = '';
}

function resetAccountSecretDialog() {
  accountSecretForm.field = 'appleId';
  accountSecretForm.reason = '';
  accountSecretForm.value = '';
}

function canRevealAccountSecret(permission: string) {
  return (
    authStore.user?.roles.includes('admin') || authStore.user?.permissions.includes(permission)
  );
}

function getAccountSecretOptions(account: AppleAccount) {
  const options: Array<{
    label: string;
    value: AppleAccountSecretField;
    permission: string;
    hasValue: boolean;
  }> = [
    {
      label: '完整 Apple ID',
      value: 'appleId',
      permission: 'apple.account.view_full',
      hasValue: true
    },
    {
      label: '密码',
      value: 'password',
      permission: 'apple.secret.view_password',
      hasValue: account.hasPassword
    },
    {
      label: '密保',
      value: 'securityInfo',
      permission: 'apple.secret.view_security',
      hasValue: account.hasSecurityInfo
    },
    {
      label: '绑定手机号',
      value: 'phone',
      permission: 'apple.secret.view_phone',
      hasValue: account.hasPhone
    },
    {
      label: '备用邮箱',
      value: 'recoveryEmail',
      permission: 'apple.secret.view_email',
      hasValue: account.hasRecoveryEmail
    }
  ];

  return options.filter((item) => item.hasValue && canRevealAccountSecret(item.permission));
}

function openTopup(account: AppleAccount) {
  selectedAccount.value = account;
  resetTopupForm();
  topupDialogVisible.value = true;
}

function openConsumption(account: AppleAccount) {
  selectedAccount.value = account;
  resetConsumptionForm();
  consumptionDialogVisible.value = true;
}

function openStatusCheck(account: AppleAccount) {
  selectedAccount.value = account;
  resetStatusCheckForm(account);
  statusCheckDialogVisible.value = true;
}

function openAccountSecret(account: AppleAccount) {
  selectedAccount.value = account;
  resetAccountSecretDialog();
  const firstOption = getAccountSecretOptions(account)[0];

  if (!firstOption) {
    ElMessage.warning('当前账号没有可查看的敏感字段，或你没有对应权限');
    return;
  }

  accountSecretForm.field = firstOption.value;
  accountSecretDialogVisible.value = true;
}

async function openRecords(account: AppleAccount) {
  selectedAccount.value = account;
  recordsDrawerVisible.value = true;
  await loadBalanceRecords();
}

function openDetail(account: AppleAccount) {
  router.push({
    path: '/apple/accounts/detail',
    query: {
      id: account.id
    }
  });
}

function openGiftCodeDialog(topup: AppleBalanceTopup) {
  selectedTopup.value = topup;
  giftCodeForm.reason = '';
  giftCodeForm.code = '';
  giftCodeDialogVisible.value = true;
}

async function loadBalanceRecords() {
  if (!selectedAccount.value) {
    return;
  }

  recordsLoading.value = true;
  try {
    const [topupData, consumptionData] = await Promise.all([
      appleAccountsApi.listTopups(selectedAccount.value.id, { page: 1, pageSize: 20 }),
      appleAccountsApi.listConsumptions(selectedAccount.value.id, { page: 1, pageSize: 20 })
    ]);
    topups.value = topupData.items;
    consumptions.value = consumptionData.items;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载余额流水失败');
  } finally {
    recordsLoading.value = false;
  }
}

async function saveAccount() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      region: form.region,
      currency: form.currency,
      currentBalance: form.currentBalance,
      balanceCostAmount: form.balanceCostAmount,
      status: form.status,
      isManuallyLocked: form.isManuallyLocked,
      manualLockReason: form.manualLockReason || null,
      password: form.password || undefined,
      securityInfo: form.securityInfo || undefined,
      phone: form.phone || undefined,
      recoveryEmail: form.recoveryEmail || undefined,
      remark: form.remark || null
    };

    if (editingAccount.value) {
      await appleAccountsApi.update(editingAccount.value.id, payload);
    } else {
      await appleAccountsApi.create({
        ...payload,
        appleId: form.appleId
      });
    }

    ElMessage.success('Apple ID 已保存');
    dialogVisible.value = false;
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存 Apple ID 失败');
  } finally {
    saving.value = false;
  }
}

async function submitImport() {
  const valid = await importFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  const accounts = importForm.accountsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (!accounts.length) {
    ElMessage.warning('请输入至少一个 Apple ID');
    return;
  }

  importing.value = true;
  try {
    const result = await appleAccountsApi.importAccounts({ accounts });
    importResult.value = result;
    ElMessage.success(`成功导入 ${result.successCount} 个 Apple ID`);
    await loadAccounts();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入 Apple ID 失败');
  } finally {
    importing.value = false;
  }
}

async function refreshSelectedAccount() {
  await loadAccounts();
  if (!selectedAccount.value) {
    return;
  }

  selectedAccount.value =
    accounts.value.find((account) => account.id === selectedAccount.value?.id) ??
    selectedAccount.value;
}

async function saveTopup() {
  const valid = await topupFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingBalanceRecord.value = true;
  try {
    await appleAccountsApi.createTopup(selectedAccount.value.id, {
      faceValue: topupForm.faceValue,
      costAmount: topupForm.costAmount,
      giftCardCode: topupForm.giftCardCode || null,
      remark: topupForm.remark || null
    });
    ElMessage.success('充值已保存');
    topupDialogVisible.value = false;
    await refreshSelectedAccount();
    await loadBalanceRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存充值失败');
  } finally {
    savingBalanceRecord.value = false;
  }
}

async function saveConsumption() {
  const valid = await consumptionFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingBalanceRecord.value = true;
  try {
    await appleAccountsApi.createConsumption(selectedAccount.value.id, {
      amount: consumptionForm.amount,
      reason: consumptionForm.reason || null,
      remark: consumptionForm.remark || null
    });
    ElMessage.success('消费已保存');
    consumptionDialogVisible.value = false;
    await refreshSelectedAccount();
    await loadBalanceRecords();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存消费失败');
  } finally {
    savingBalanceRecord.value = false;
  }
}

async function saveStatusCheck() {
  const valid = await statusCheckFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  savingStatusCheck.value = true;
  try {
    await appleAccountsApi.createStatusCheck(selectedAccount.value.id, {
      checkType: 'manual',
      resultStatus: statusCheckForm.resultStatus,
      balanceSnapshot: statusCheckForm.balanceSnapshot || null,
      remark: statusCheckForm.remark || null
    });
    ElMessage.success('状态检测已保存');
    statusCheckDialogVisible.value = false;
    await refreshSelectedAccount();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存状态检测失败');
  } finally {
    savingStatusCheck.value = false;
  }
}

async function revealGiftCardCode() {
  const valid = await giftCodeFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedTopup.value) {
    return;
  }

  revealingGiftCode.value = true;
  try {
    const data = await appleAccountsApi.revealGiftCardCode(selectedTopup.value.id, {
      reason: giftCodeForm.reason
    });
    giftCodeForm.code = data.giftCardCode;
    ElMessage.success('完整礼品卡代码已显示，审计日志已记录');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整礼品卡代码失败');
  } finally {
    revealingGiftCode.value = false;
  }
}

async function revealAccountSecret() {
  const valid = await accountSecretFormRef.value?.validate().catch(() => false);
  if (!valid || !selectedAccount.value) {
    return;
  }

  revealingAccountSecret.value = true;
  try {
    const data = await appleAccountsApi.revealSecret(selectedAccount.value.id, {
      field: accountSecretForm.field,
      reason: accountSecretForm.reason
    });
    accountSecretForm.value = data.value;
    ElMessage.success('完整资料已显示，审计日志已记录');
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '查看完整资料失败');
  } finally {
    revealingAccountSecret.value = false;
  }
}

async function initializePage() {
  await loadTableViews(true);
  await loadAccounts();
}

onMounted(initializePage);
</script>
