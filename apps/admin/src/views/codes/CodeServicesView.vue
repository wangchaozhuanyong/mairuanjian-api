<template>
  <PageScaffold
    title="兑换码业务设置"
    group="兑换码自动发货"
    phase="Phase 6"
    description="配置兑换码面值、默认成本、售价、发货方式和组合规则。该业务设置只服务兑换码系统，不和 Apple ID 业务混用。"
  >
    <section class="content-panel code-compact-list-panel">
      <div class="panel-title-row">
        <PanelTitleHelp
          title="兑换码业务规则"
          help="这里配置兑换码商品怎么卖、成本多少、怎么发货，以及淘宝/闲鱼 SKU 怎么识别。它只服务兑换码自动发货，不和 Apple ID 代充混用。"
        />
        <div class="inline-actions">
          <StatusChip tone="blue" dot>共 {{ total }} 个业务</StatusChip>
          <StatusChip tone="green">启用 {{ enabledCount }}</StatusChip>
          <StatusChip :tone="semiAutoCount > 0 ? 'orange' : 'green'" dot>
            {{ semiAutoCount > 0 ? `半自动 ${semiAutoCount}` : '自动规则稳定' }}
          </StatusChip>
          <StatusChip tone="purple">允许组合 {{ combinationCount }}</StatusChip>
        </div>
      </div>

      <TableToolbar
        v-model:keyword="query.keyword"
        v-model:status="query.status"
        v-model:visible-columns="visibleColumns"
        v-model:saved-view-id="savedViewId"
        :column-options="serviceColumnOptions"
        :status-options="statusOptions"
        :saved-views="savedViews"
        :filter-chips="filterChips"
        :selected-count="selectedServices.length"
        :batch-actions="batchActions"
        :show-date-shortcut="false"
        primary-label="新增兑换码业务"
        placeholder="搜索业务名称、面值、备注"
        @search="handleSearch"
        @refresh="() => loadServices()"
        @primary="openCreate"
        @clear-filters="clearFilters"
        @remove-filter="removeFilter"
        @save-view="saveTableView"
        @apply-view="applySavedView"
        @export="exportList"
        @batch-action="handleBatchAction"
      >
        <template #filters>
          <el-select
            v-model="query.deliveryMode"
            class="table-toolbar__select"
            clearable
            placeholder="发货方式"
            @change="handleSearch"
          >
            <el-option
              v-for="mode in deliveryModeOptions"
              :key="mode.value"
              :label="mode.label"
              :value="mode.value"
            />
          </el-select>
        </template>
      </TableToolbar>

      <el-table
        v-loading="loading"
        class="desktop-data-table"
        :data="services"
        :size="tableSize"
        row-key="id"
        @selection-change="handleSelectionChange"
        @sort-change="handleSortChange"
      >
        <template #empty>
          <div class="apple-core-empty-state">
            <strong>暂无兑换码业务</strong>
            <span>可以新增业务，或清空筛选后查看已有兑换码业务配置。</span>
            <div class="apple-core-empty-state__actions">
              <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
              <AppButton variant="primary" @click="openCreate">新增兑换码业务</AppButton>
            </div>
          </div>
        </template>
        <el-table-column type="selection" width="46" />
        <el-table-column
          v-if="isColumnVisible('name')"
          prop="name"
          label="业务"
          min-width="180"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('faceValue')"
          prop="faceValue"
          label="面值"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('defaultCost')"
          prop="defaultCost"
          label="默认成本"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('defaultPrice')"
          prop="defaultPrice"
          label="默认售价"
          width="110"
          sortable="custom"
        />
        <el-table-column
          v-if="isColumnVisible('deliveryMode')"
          prop="deliveryMode"
          label="发货方式"
          width="110"
          sortable="custom"
        >
          <template #default="{ row }">{{ getDeliveryModeLabel(row.deliveryMode) }}</template>
        </el-table-column>
        <el-table-column v-if="isColumnVisible('rules')" label="匹配规则" min-width="160">
          <template #default="{ row }">
            <StatusChip tone="blue">
              {{ row.exactFaceValueOnly ? '精确面值' : '允许近似' }}
            </StatusChip>
            <StatusChip v-if="row.allowCombination" class="tag-gap" tone="orange">
              可组合
            </StatusChip>
          </template>
        </el-table-column>
        <el-table-column
          v-if="isColumnVisible('status')"
          prop="status"
          label="状态"
          width="90"
          sortable="custom"
        >
          <template #default="{ row }">
            <StatusChip :tone="getStatusTone(row.status)" dot>
              {{ getStatusLabel(row.status) }}
            </StatusChip>
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
        <el-table-column label="操作" width="170" fixed="right">
          <template #default="{ row }">
            <div class="table-action-group table-action-group--wrap">
              <AppButton variant="ghost" @click="openEdit(row)">编辑</AppButton>
              <AppButton variant="ghost" @click="openMappings(row)">平台映射</AppButton>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="services.length" class="mobile-record-list">
        <article v-for="service in services" :key="service.id" class="mobile-record-card">
          <div class="mobile-record-card__head">
            <div class="mobile-record-card__title">
              <strong>{{ service.name }}</strong>
              <span
                >面值 {{ service.faceValue }} ·
                {{ getDeliveryModeLabel(service.deliveryMode) }}</span
              >
            </div>
            <StatusChip :tone="getStatusTone(service.status)" dot>
              {{ getStatusLabel(service.status) }}
            </StatusChip>
          </div>

          <div class="mobile-record-card__stats">
            <div>
              <span>默认成本</span>
              <strong>{{ service.defaultCost }}</strong>
            </div>
            <div>
              <span>默认售价</span>
              <strong>{{ service.defaultPrice }}</strong>
            </div>
            <div>
              <span>发货方式</span>
              <strong>{{ getDeliveryModeLabel(service.deliveryMode) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__meta">
            <div>
              <span>匹配规则</span>
              <div class="mobile-record-card__chips">
                <StatusChip tone="blue">
                  {{ service.exactFaceValueOnly ? '精确面值' : '允许近似' }}
                </StatusChip>
                <StatusChip v-if="service.allowCombination" tone="orange">可组合</StatusChip>
              </div>
            </div>
            <div>
              <span>更新时间</span>
              <strong>{{ formatDate(service.updatedAt) }}</strong>
            </div>
          </div>

          <div class="mobile-record-card__actions">
            <AppButton size="small" variant="ghost" @click="openEdit(service)">编辑</AppButton>
            <AppButton size="small" variant="ghost" @click="openMappings(service)">
              平台映射
            </AppButton>
          </div>
        </article>
      </div>

      <div v-else class="mobile-record-list">
        <div class="apple-core-empty-state">
          <strong>暂无兑换码业务</strong>
          <span>可以新增业务，或清空筛选后查看已有兑换码业务配置。</span>
          <div class="apple-core-empty-state__actions">
            <AppButton variant="soft" @click="clearFilters">清空筛选</AppButton>
            <AppButton variant="primary" @click="openCreate">新增兑换码业务</AppButton>
          </div>
        </div>
      </div>

      <PaginationBar
        v-model:page="query.page"
        v-model:page-size="query.pageSize"
        :total="total"
        @change="() => loadServices()"
      />
    </section>

    <el-dialog
      v-model="dialogVisible"
      :title="editingService ? '编辑兑换码业务' : '新增兑换码业务'"
      width="min(720px, calc(100vw - 24px))"
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid">
          <el-form-item prop="name">
            <template #label>
              <FieldHelpLabel
                label="业务名称"
                purpose="兑换码业务的名称，库存、订单匹配、发货和报表都会显示它。"
                example="可以填 ChatGPT 20 USD 兑换码、Apple Gift Card 100 HKD。"
              />
            </template>
            <el-input v-model.trim="form.name" />
          </el-form-item>
          <el-form-item prop="faceValue">
            <template #label>
              <FieldHelpLabel
                label="面值"
                purpose="这类兑换码本身的金额或规格，系统按它匹配订单和库存。"
                example="20 USD 礼品卡填 20 USD；100 港币卡填 100 HKD。"
              />
            </template>
            <el-input v-model.trim="form.faceValue" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="默认成本"
                purpose="批量导入兑换码时默认使用的采购成本，用于计算订单利润。"
                example="每张码买入价 16 元就填 16；单批成本不同可在导入时改。"
              />
            </template>
            <el-input v-model.trim="form.defaultCost" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="默认售价"
                purpose="这类兑换码默认卖给客户多少钱，手工订单可用它做参考。"
                example="平时卖 20 元就填 20；平台活动价可在订单里按实际实付填写。"
              />
            </template>
            <el-input v-model.trim="form.defaultPrice" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="发货方式"
                purpose="决定订单匹配到兑换码后，系统是自动发货、半自动确认还是完全手工处理。"
                example="平台接口稳定可选自动；需要人工复制内容选半自动；特殊商品选手工。"
              />
            </template>
            <el-select v-model="form.deliveryMode" class="full-input">
              <el-option
                v-for="mode in deliveryModeOptions"
                :key="mode.value"
                :label="mode.label"
                :value="mode.value"
              />
            </el-select>
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="匹配和发货规则"
              purpose="控制订单匹配库存时是否必须同面值，以及能不能多张码组合发货。"
              example="20 USD 订单只发 20 USD 卡就勾精确匹配；允许两张 10 USD 组合就勾允许组合发货。"
            />
          </template>
          <el-checkbox v-model="form.exactFaceValueOnly">只允许精确面值匹配</el-checkbox>
          <el-checkbox v-model="form.allowCombination">允许组合发货</el-checkbox>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="状态"
              purpose="控制这个兑换码业务是否能继续接单和匹配库存。"
              example="正常卖选启用；暂时缺货选暂停；以后不卖了选停用。"
            />
          </template>
          <el-radio-group v-model="form.status">
            <el-radio-button value="enabled">启用</el-radio-button>
            <el-radio-button value="paused">暂停</el-radio-button>
            <el-radio-button value="disabled">停用</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="备注"
              purpose="写给员工看的兑换码业务补充说明，不参与自动匹配。"
              example="可以写进货来源、发货注意事项、售后处理规则。"
            />
          </template>
          <el-input v-model="form.remark" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="dialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="saving" @click="saveService">保存</AppButton>
      </template>
    </el-dialog>

    <AppDrawer
      v-model="mappingDrawerVisible"
      :title="`平台映射 · ${selectedService?.name ?? ''}`"
      confirm-text="新增映射"
      size="min(880px, 100vw)"
      @confirm="openCreateMapping"
    >
      <div class="drawer-section drawer-section--flush">
        <div class="drawer-section__title">
          <span>平台商品/SKU 映射</span>
          <AppButton @click="() => loadMappings()">刷新</AppButton>
        </div>
        <p class="drawer-section__description">
          用于后续淘宝、闲鱼订单同步时识别兑换码业务，不和 Apple ID 平台映射混用。
        </p>

        <el-table
          v-loading="mappingLoading"
          class="desktop-data-table"
          :data="mappings"
          row-key="id"
        >
          <template #empty>
            <div class="apple-core-empty-state">
              <strong>暂无平台映射</strong>
              <span>新增平台商品或 SKU 映射后，淘宝/闲鱼订单才能自动匹配兑换码业务。</span>
              <div class="apple-core-empty-state__actions">
                <AppButton variant="primary" @click="openCreateMapping">新增映射</AppButton>
              </div>
            </div>
          </template>
          <el-table-column label="平台/店铺" min-width="170">
            <template #default="{ row }">
              {{ row.platform.name }}
              <div class="muted-block">{{ row.shopId || row.platform.name }}</div>
            </template>
          </el-table-column>
          <el-table-column label="商品/SKU" min-width="190">
            <template #default="{ row }">
              {{ row.platformItemId }}
              <div class="muted-block">SKU {{ row.platformSkuId || '-' }}</div>
            </template>
          </el-table-column>
          <el-table-column label="面值/数量" width="130">
            <template #default="{ row }">{{ row.faceValue }} × {{ row.quantity }}</template>
          </el-table-column>
          <el-table-column label="关键词" min-width="140">
            <template #default="{ row }">{{ row.skuKeyword || '-' }}</template>
          </el-table-column>
          <el-table-column label="模板" min-width="150">
            <template #default="{ row }">{{ row.deliveryTemplate?.name || '-' }}</template>
          </el-table-column>
          <el-table-column label="启用" width="90">
            <template #default="{ row }">
              <StatusChip :tone="row.enabled ? 'green' : 'neutral'" dot>
                {{ row.enabled ? '启用' : '停用' }}
              </StatusChip>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="130" fixed="right">
            <template #default="{ row }">
              <div class="table-action-group">
                <AppButton variant="ghost" @click="openEditMapping(row)">编辑</AppButton>
                <AppButton variant="danger" @click="deleteMapping(row)">删除</AppButton>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <div v-if="mappings.length" class="mobile-record-list" aria-label="平台商品映射移动列表">
          <article v-for="mapping in mappings" :key="mapping.id" class="mobile-record-card">
            <div class="mobile-record-card__head">
              <div class="mobile-record-card__title">
                <strong>{{ mapping.platform.name }}</strong>
                <span>{{ mapping.platformItemId }} · SKU {{ mapping.platformSkuId || '-' }}</span>
              </div>
              <StatusChip :tone="mapping.enabled ? 'green' : 'neutral'" dot>
                {{ mapping.enabled ? '启用' : '停用' }}
              </StatusChip>
            </div>
            <div class="mobile-record-card__stats">
              <div>
                <span>面值/数量</span>
                <strong>{{ mapping.faceValue }} × {{ mapping.quantity }}</strong>
              </div>
              <div>
                <span>关键词</span>
                <strong>{{ mapping.skuKeyword || '-' }}</strong>
              </div>
              <div>
                <span>模板</span>
                <strong>{{ mapping.deliveryTemplate?.name || '-' }}</strong>
              </div>
            </div>
            <div class="mobile-record-card__actions">
              <AppButton size="small" variant="ghost" @click="openEditMapping(mapping)">
                编辑
              </AppButton>
              <AppButton size="small" variant="danger" @click="deleteMapping(mapping)">
                删除
              </AppButton>
            </div>
          </article>
        </div>
        <div v-else-if="!mappingLoading" class="mobile-record-list">
          <div class="apple-core-empty-state">
            <strong>暂无平台映射</strong>
            <span>新增平台商品或 SKU 映射后，淘宝/闲鱼订单才能自动匹配兑换码业务。</span>
          </div>
        </div>
      </div>
    </AppDrawer>

    <el-dialog
      v-model="mappingDialogVisible"
      :title="editingMapping ? '编辑平台映射' : '新增平台映射'"
      width="min(720px, calc(100vw - 24px))"
    >
      <el-form ref="mappingFormRef" :model="mappingForm" :rules="mappingRules" label-position="top">
        <div class="form-grid">
          <el-form-item prop="platformId">
            <template #label>
              <FieldHelpLabel
                label="来源平台"
                purpose="这条映射属于哪个平台，用来把平台订单识别成兑换码业务。"
                example="淘宝商品选淘宝，闲鱼商品选闲鱼。"
              />
            </template>
            <el-select v-model="mappingForm.platformId" class="full-input" filterable>
              <el-option
                v-for="platform in sourcePlatforms"
                :key="platform.id"
                :label="platform.name"
                :value="platform.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="店铺/账号"
                purpose="记录平台店铺、账号或渠道名称，多个店铺时用来区分。"
                example="可以填淘宝主店、闲鱼 1 号、企业店。"
              />
            </template>
            <el-input v-model.trim="mappingForm.shopId" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item prop="platformItemId">
            <template #label>
              <FieldHelpLabel
                label="平台商品 ID"
                purpose="平台商品的唯一编号，系统用它识别订单应该匹配哪个兑换码业务。"
                example="从淘宝/闲鱼订单或商品后台复制 itemId。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformItemId" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="平台 SKU ID"
                purpose="同一个平台商品下不同规格的编号，用来区分不同面值或数量。"
                example="只有一个规格可留空；多个规格就填对应 SKU ID。"
              />
            </template>
            <el-input v-model.trim="mappingForm.platformSkuId" />
          </el-form-item>
        </div>
        <div class="form-grid">
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="SKU 关键词"
                purpose="当 SKU ID 不稳定或为空时，用规格文字辅助匹配订单。"
                example="可以填 20USD、100HKD、月卡、季卡等订单里会出现的词。"
              />
            </template>
            <el-input v-model.trim="mappingForm.skuKeyword" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="发货数量"
                purpose="这个平台规格下单一次需要发几张兑换码。"
                example="买 1 张码填 1；一个套餐要发 2 张码就填 2。"
              />
            </template>
            <el-input-number v-model="mappingForm.quantity" :min="1" class="full-input" />
          </el-form-item>
          <el-form-item>
            <template #label>
              <FieldHelpLabel
                label="面值"
                purpose="平台规格对应的兑换码面值，用来进一步确认匹配结果。"
                example="商品规格写 20 USD 就填 20 USD，避免错发别的面值。"
              />
            </template>
            <el-input v-model.trim="mappingForm.faceValue" />
          </el-form-item>
        </div>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="发货模板"
              purpose="生成发货内容时使用的消息模板，决定发给买家的文字格式。"
              example="自动发货选含兑换码变量的模板；手工发货也可以选常用回复模板。"
            />
          </template>
          <el-select v-model="mappingForm.deliveryTemplateId" class="full-input" clearable>
            <el-option
              v-for="template in deliveryTemplates"
              :key="template.id"
              :label="template.name"
              :value="template.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <template #label>
            <FieldHelpLabel
              label="启用状态"
              purpose="控制这条平台商品映射是否生效。"
              example="商品还在卖就启用；映射未确认或商品下架就停用。"
            />
          </template>
          <el-switch v-model="mappingForm.enabled" active-text="启用" inactive-text="停用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <AppButton @click="mappingDialogVisible = false">取消</AppButton>
        <AppButton variant="primary" :loading="mappingSaving" @click="saveMapping">保存</AppButton>
      </template>
    </el-dialog>
  </PageScaffold>
</template>

<script setup lang="ts">
import type { FormInstance, FormRules } from 'element-plus';
import { ElMessage, ElMessageBox } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { codeServicesApi, dataCenterApi, userTableViewsApi } from '@/api/system';
import type { CodePlatformMappingQuery, CodeServiceQuery, DataDictionaryQuery } from '@/api/system';
import AppButton from '@/components/ui/AppButton.vue';
import AppDrawer from '@/components/ui/AppDrawer.vue';
import FieldHelpLabel from '@/components/ui/FieldHelpLabel.vue';
import PageScaffold from '@/components/ui/PageScaffold.vue';
import PanelTitleHelp from '@/components/ui/PanelTitleHelp.vue';
import PaginationBar from '@/components/ui/PaginationBar.vue';
import StatusChip from '@/components/ui/StatusChip.vue';
import TableToolbar from '@/components/ui/TableToolbar.vue';
import { CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP } from '@/config/quickSettings';
import { onRealtimeQueryInvalidated } from '@/realtime/realtimeQueryEvents';
import type {
  CodePlatformMapping,
  CodeService,
  DataDictionary,
  MessageTemplate,
  PageResult,
  SourcePlatform,
  TableDensity,
  UserTableView
} from '@/types/system';
import {
  buildCodeServiceDeliveryModeOptions,
  getCodeServiceDeliveryModeLabel as getConfiguredCodeServiceDeliveryModeLabel
} from '@/utils/codeServiceDeliveryModes';
import { createSmartQueryKey, getSmartQueryData, refreshSmartQuery } from '@/utils/smartQuery';
import { loadSmartMessageTemplates, loadSmartSourcePlatforms } from '@/utils/smartSystemQueries';

const tableKey = 'code_services';
const statusOptions = [
  { label: '启用', value: 'enabled' },
  { label: '暂停', value: 'paused' },
  { label: '停用', value: 'disabled' }
];
const serviceColumnOptions = [
  { label: '业务', value: 'name', required: true },
  { label: '面值', value: 'faceValue' },
  { label: '默认成本', value: 'defaultCost' },
  { label: '默认售价', value: 'defaultPrice' },
  { label: '发货方式', value: 'deliveryMode' },
  { label: '匹配规则', value: 'rules' },
  { label: '状态', value: 'status' },
  { label: '更新时间', value: 'updatedAt' }
];
const batchActions = [{ label: '批量导出', value: 'export' }];

const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const mappingDrawerVisible = ref(false);
const mappingDialogVisible = ref(false);
const editingService = ref<CodeService | null>(null);
const selectedService = ref<CodeService | null>(null);
const editingMapping = ref<CodePlatformMapping | null>(null);
const services = ref<CodeService[]>([]);
const selectedServices = ref<CodeService[]>([]);
const mappings = ref<CodePlatformMapping[]>([]);
const sourcePlatforms = ref<SourcePlatform[]>([]);
const deliveryTemplates = ref<MessageTemplate[]>([]);
const deliveryModeDictionaries = ref<DataDictionary[]>([]);
const total = ref(0);
const formRef = ref<FormInstance>();
const mappingFormRef = ref<FormInstance>();
const mappingLoading = ref(false);
const mappingSaving = ref(false);
const density = ref<TableDensity>('default');
const visibleColumns = ref<string[]>([]);
const savedViews = ref<UserTableView[]>([]);
const savedViewId = ref('');
const sortConfig = ref<{ prop?: string; order?: 'ascending' | 'descending' | null }>({});
const activeServicesQueryKey = ref('');
const activeMappingsQueryKey = ref('');
const activeDeliveryModesQueryKey = ref('');

const query = reactive({
  page: 1,
  pageSize: 20,
  keyword: '',
  status: '',
  deliveryMode: ''
});

const form = reactive({
  name: '',
  faceValue: '',
  defaultPrice: '0',
  defaultCost: '0',
  deliveryMode: 'semi_auto' as CodeService['deliveryMode'],
  exactFaceValueOnly: true,
  allowCombination: false,
  status: 'enabled' as CodeService['status'],
  remark: ''
});

const mappingForm = reactive({
  platformId: '',
  shopId: '',
  platformItemId: '',
  platformSkuId: '',
  skuKeyword: '',
  faceValue: '',
  quantity: 1,
  deliveryTemplateId: '',
  enabled: true
});

const rules: FormRules<typeof form> = {
  name: [{ required: true, message: '请输入业务名称', trigger: 'blur' }],
  faceValue: [{ required: true, message: '请输入面值', trigger: 'blur' }]
};

const mappingRules: FormRules<typeof mappingForm> = {
  platformId: [{ required: true, message: '请选择来源平台', trigger: 'change' }],
  platformItemId: [{ required: true, message: '请输入平台商品 ID', trigger: 'blur' }]
};

const enabledCount = computed(
  () => services.value.filter((service) => service.status === 'enabled').length
);
const semiAutoCount = computed(
  () => services.value.filter((service) => service.deliveryMode === 'semi_auto').length
);
const combinationCount = computed(
  () => services.value.filter((service) => service.allowCombination).length
);
const tableSize = computed(() =>
  density.value === 'compact' ? 'small' : density.value === 'loose' ? 'large' : 'default'
);
const deliveryModeOptions = computed(() =>
  buildCodeServiceDeliveryModeOptions(deliveryModeDictionaries.value)
);
const filterChips = computed(() => {
  const chips: Array<{ key: string; label: string; value: string }> = [];
  const deliveryModeLabel = deliveryModeOptions.value.find(
    (mode) => mode.value === query.deliveryMode
  )?.label;
  if (query.deliveryMode && deliveryModeLabel) {
    chips.push({ key: 'deliveryMode', label: '发货方式', value: deliveryModeLabel });
  }
  return chips;
});

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '-';
}

function getDeliveryModeLabel(mode: CodeService['deliveryMode']) {
  return getConfiguredCodeServiceDeliveryModeLabel(mode, deliveryModeDictionaries.value);
}

function getDefaultDeliveryMode(): CodeService['deliveryMode'] {
  return deliveryModeOptions.value[0]?.value ?? 'semi_auto';
}

function getStatusLabel(status: CodeService['status']) {
  const labels: Record<CodeService['status'], string> = {
    enabled: '启用',
    paused: '暂停',
    disabled: '停用'
  };
  return labels[status];
}

function getStatusTone(status: CodeService['status']) {
  if (status === 'enabled') {
    return 'green';
  }
  if (status === 'paused') {
    return 'orange';
  }
  return 'neutral';
}

function isColumnVisible(column: string) {
  return visibleColumns.value.length ? visibleColumns.value.includes(column) : true;
}

function buildServiceParams(): CodeServiceQuery {
  return {
    page: query.page,
    pageSize: query.pageSize,
    keyword: query.keyword || undefined,
    status: query.status || undefined,
    deliveryMode: query.deliveryMode || undefined,
    sortBy: sortConfig.value.prop,
    sortOrder: mapSortOrder(sortConfig.value.order)
  };
}

function applyServiceResult(data: PageResult<CodeService>) {
  services.value = data.items;
  total.value = data.total;
}

async function loadServices(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildServiceParams();
  const key = createSmartQueryKey('code-services', params);
  const cached = getSmartQueryData<PageResult<CodeService>>(key);

  activeServicesQueryKey.value = key;

  if (cached) {
    applyServiceResult(cached);
  }

  loading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => codeServicesApi.list(params),
      force: options.force ?? true
    });

    if (activeServicesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyServiceResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码业务失败');
    }
  } finally {
    if (activeServicesQueryKey.value === key) {
      loading.value = false;
    }
  }
}

function buildDeliveryModeParams(): DataDictionaryQuery {
  return {
    page: 1,
    pageSize: 20,
    group: CODE_SERVICE_DELIVERY_MODE_DICTIONARY_GROUP,
    sortBy: 'sortOrder',
    sortOrder: 'asc'
  };
}

function applyDeliveryModeResult(data: PageResult<DataDictionary>) {
  deliveryModeDictionaries.value = data.items;
}

async function loadDeliveryModes(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildDeliveryModeParams();
  const key = createSmartQueryKey('code-service-delivery-modes', params);
  const cached = getSmartQueryData<PageResult<DataDictionary>>(key);

  activeDeliveryModesQueryKey.value = key;

  if (cached) {
    applyDeliveryModeResult(cached);
  }

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => dataCenterApi.listDictionaries(params),
      force: options.force ?? true
    });

    if (activeDeliveryModesQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyDeliveryModeResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载兑换码业务发货模式失败');
    }
  }
}

async function handleSearch() {
  query.page = 1;
  await loadServices();
}

async function handleSortChange(payload: {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
}) {
  sortConfig.value = payload.prop ? { prop: payload.prop, order: payload.order } : {};
  query.page = 1;
  await loadServices();
}

function handleSelectionChange(rows: CodeService[]) {
  selectedServices.value = rows;
}

function clearFilters() {
  query.page = 1;
  query.keyword = '';
  query.status = '';
  query.deliveryMode = '';
  savedViewId.value = '';
  sortConfig.value = {};
}

function removeFilter(key: string) {
  if (key === 'deliveryMode') {
    query.deliveryMode = '';
  }
}

function exportList() {
  ElMessage.info('兑换码业务设置导出会进入数据中心导出任务，后续统一接入');
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
    const { value } = await ElMessageBox.prompt('请输入视图名称', '保存兑换码业务视图', {
      inputValue: '兑换码业务常用视图',
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
        deliveryMode: query.deliveryMode
      },
      sortConfig: sortConfig.value,
      columns: visibleColumns.value.length
        ? visibleColumns.value
        : serviceColumnOptions.map((column) => column.value),
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
  await loadServices();
}

function applyView(view: UserTableView) {
  const filters = view.filters;
  query.keyword = typeof filters.keyword === 'string' ? filters.keyword : '';
  query.status = isServiceStatus(filters.status) ? filters.status : '';
  query.deliveryMode = isDeliveryMode(filters.deliveryMode) ? filters.deliveryMode : '';
  query.pageSize = view.pageSize;
  density.value = 'default';
  visibleColumns.value = view.columns.length
    ? view.columns.filter((column) =>
        serviceColumnOptions.some((option) => option.value === column)
      )
    : serviceColumnOptions.map((column) => column.value);
  sortConfig.value = parseSortConfig(view.sortConfig);
  savedViewId.value = view.id;
}

function parseSortConfig(value: Record<string, unknown>): {
  prop?: string;
  order?: 'ascending' | 'descending' | null;
} {
  const prop = typeof value.prop === 'string' ? value.prop : undefined;
  const order =
    value.order === 'ascending' || value.order === 'descending' || value.order === null
      ? value.order
      : undefined;
  return prop ? { prop, order } : {};
}

function mapSortOrder(order?: 'ascending' | 'descending' | null) {
  if (order === 'ascending') return 'asc';
  if (order === 'descending') return 'desc';
  return undefined;
}

function isServiceStatus(value: unknown): value is CodeService['status'] | '' {
  return value === '' || value === 'enabled' || value === 'paused' || value === 'disabled';
}

function isDeliveryMode(value: unknown): value is CodeService['deliveryMode'] | '' {
  return value === '' || value === 'auto' || value === 'semi_auto' || value === 'manual';
}

async function initializePage() {
  await Promise.all([
    loadTableViews(true),
    loadDeliveryModes({ force: false }),
    loadServices({ force: false })
  ]);
}

async function loadMappingDependencies() {
  const [platformData, templateData] = await Promise.all([
    loadSmartSourcePlatforms({
      page: 1,
      pageSize: 100,
      status: 'active'
    }),
    loadSmartMessageTemplates({
      page: 1,
      pageSize: 100,
      status: 'active',
      type: 'delivery',
      channel: 'customer_service'
    })
  ]);
  sourcePlatforms.value = platformData.items;
  deliveryTemplates.value = templateData.items;
}

function buildMappingParams(): CodePlatformMappingQuery | null {
  if (!selectedService.value) {
    return null;
  }

  return {
    page: 1,
    pageSize: 100,
    serviceId: selectedService.value.id
  };
}

function applyMappingResult(data: PageResult<CodePlatformMapping>) {
  mappings.value = data.items;
}

async function loadMappings(options: { background?: boolean; force?: boolean } = {}) {
  const params = buildMappingParams();

  if (!params) {
    return;
  }

  const key = createSmartQueryKey('code-service-mappings', params);
  const cached = getSmartQueryData<PageResult<CodePlatformMapping>>(key);

  activeMappingsQueryKey.value = key;

  if (cached) {
    applyMappingResult(cached);
  }

  mappingLoading.value = !cached && !options.background;

  try {
    const result = await refreshSmartQuery({
      key,
      fetcher: () => codeServicesApi.listPlatformMappings(params),
      force: options.force ?? true
    });

    if (activeMappingsQueryKey.value !== key) {
      return;
    }

    if (result.changed || !cached) {
      applyMappingResult(result.data);
    }
  } catch (error) {
    if (!options.background) {
      ElMessage.error(error instanceof Error ? error.message : '加载平台映射失败');
    }
  } finally {
    if (activeMappingsQueryKey.value === key) {
      mappingLoading.value = false;
    }
  }
}

function resetForm() {
  form.name = '';
  form.faceValue = '';
  form.defaultPrice = '0';
  form.defaultCost = '0';
  form.deliveryMode = getDefaultDeliveryMode();
  form.exactFaceValueOnly = true;
  form.allowCombination = false;
  form.status = 'enabled';
  form.remark = '';
}

function openCreate() {
  editingService.value = null;
  resetForm();
  dialogVisible.value = true;
}

function openEdit(service: CodeService) {
  editingService.value = service;
  form.name = service.name;
  form.faceValue = service.faceValue;
  form.defaultPrice = service.defaultPrice;
  form.defaultCost = service.defaultCost;
  form.deliveryMode = service.deliveryMode;
  form.exactFaceValueOnly = service.exactFaceValueOnly;
  form.allowCombination = service.allowCombination;
  form.status = service.status;
  form.remark = service.remark ?? '';
  dialogVisible.value = true;
}

async function openMappings(service: CodeService) {
  selectedService.value = service;
  mappingDrawerVisible.value = true;
  try {
    await Promise.all([loadMappingDependencies(), loadMappings()]);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载平台映射依赖失败');
  }
}

function resetMappingForm() {
  mappingForm.platformId = sourcePlatforms.value[0]?.id ?? '';
  mappingForm.shopId = '';
  mappingForm.platformItemId = '';
  mappingForm.platformSkuId = '';
  mappingForm.skuKeyword = '';
  mappingForm.faceValue = selectedService.value?.faceValue ?? '';
  mappingForm.quantity = 1;
  mappingForm.deliveryTemplateId = '';
  mappingForm.enabled = true;
}

async function openCreateMapping() {
  if (!selectedService.value) {
    return;
  }

  editingMapping.value = null;
  if (!sourcePlatforms.value.length || !deliveryTemplates.value.length) {
    await loadMappingDependencies();
  }
  resetMappingForm();
  mappingDialogVisible.value = true;
}

function openEditMapping(mapping: CodePlatformMapping) {
  editingMapping.value = mapping;
  mappingForm.platformId = mapping.platformId;
  mappingForm.shopId = mapping.shopId ?? '';
  mappingForm.platformItemId = mapping.platformItemId;
  mappingForm.platformSkuId = mapping.platformSkuId;
  mappingForm.skuKeyword = mapping.skuKeyword ?? '';
  mappingForm.faceValue = mapping.faceValue;
  mappingForm.quantity = mapping.quantity;
  mappingForm.deliveryTemplateId = mapping.deliveryTemplateId ?? '';
  mappingForm.enabled = mapping.enabled;
  mappingDialogVisible.value = true;
}

async function saveService() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  saving.value = true;
  try {
    const payload = {
      name: form.name,
      faceValue: form.faceValue,
      defaultPrice: form.defaultPrice,
      defaultCost: form.defaultCost,
      deliveryMode: form.deliveryMode,
      exactFaceValueOnly: form.exactFaceValueOnly,
      allowCombination: form.allowCombination,
      status: form.status,
      remark: form.remark || null
    };

    if (editingService.value) {
      await codeServicesApi.update(editingService.value.id, payload);
      ElMessage.success('兑换码业务已更新');
    } else {
      await codeServicesApi.create(payload);
      ElMessage.success('兑换码业务已创建');
    }

    dialogVisible.value = false;
    await loadServices();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存兑换码业务失败');
  } finally {
    saving.value = false;
  }
}

async function saveMapping() {
  if (!selectedService.value) {
    return;
  }

  const valid = await mappingFormRef.value?.validate().catch(() => false);
  if (!valid) {
    return;
  }

  mappingSaving.value = true;
  try {
    const payload = {
      platformId: mappingForm.platformId,
      shopId: mappingForm.shopId || null,
      platformItemId: mappingForm.platformItemId,
      platformSkuId: mappingForm.platformSkuId || null,
      skuKeyword: mappingForm.skuKeyword || null,
      serviceId: selectedService.value.id,
      faceValue: mappingForm.faceValue || undefined,
      quantity: mappingForm.quantity,
      deliveryTemplateId: mappingForm.deliveryTemplateId || null,
      enabled: mappingForm.enabled
    };

    if (editingMapping.value) {
      await codeServicesApi.updatePlatformMapping(editingMapping.value.id, payload);
    } else {
      await codeServicesApi.createPlatformMapping(payload);
    }

    ElMessage.success('平台映射已保存');
    mappingDialogVisible.value = false;
    await loadMappings({ force: true });
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存平台映射失败');
  } finally {
    mappingSaving.value = false;
  }
}

async function deleteMapping(mapping: CodePlatformMapping) {
  try {
    await ElMessageBox.confirm(
      '删除后平台订单将无法通过该商品/SKU 自动识别此兑换码业务。',
      '删除平台映射',
      {
        type: 'warning',
        confirmButtonText: '删除',
        cancelButtonText: '取消'
      }
    );
    await codeServicesApi.removePlatformMapping(mapping.id);
    ElMessage.success('平台映射已删除');
    await loadMappings({ force: true });
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : '删除平台映射失败');
    }
  }
}

onMounted(initializePage);

const stopRealtimeRefresh = onRealtimeQueryInvalidated(
  ['code-services', 'code-service-mappings', 'data-dictionaries'],
  () => {
    void loadDeliveryModes({
      background: deliveryModeDictionaries.value.length > 0,
      force: true
    });

    void loadServices({
      background: services.value.length > 0,
      force: true
    });

    if (mappingDrawerVisible.value) {
      void loadMappings({
        background: mappings.value.length > 0,
        force: true
      });
    }
  }
);

onBeforeUnmount(stopRealtimeRefresh);
</script>

<style scoped>
.code-compact-list-panel .panel-title-row {
  align-items: flex-start;
}

.code-compact-list-panel .inline-actions {
  max-width: min(600px, 100%);
  justify-content: flex-end;
  flex-wrap: wrap;
}

@media (max-width: 840px) {
  .code-compact-list-panel .inline-actions {
    justify-content: flex-start;
  }
}
</style>
