import {
  defineAsyncComponent,
  defineComponent,
  h,
  type App,
  type Component,
  type Plugin
} from 'vue';
import { ElLoading } from 'element-plus/es/components/loading/index.mjs';

type ComponentLoader = () => Promise<Component>;

const AsyncElTable = defineAsyncComponent(() =>
  import('element-plus/es/components/table/index.mjs').then((module) => module.ElTable)
);

const ElTableWithDefaults = defineComponent({
  name: 'ElTable',
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    return () =>
      h(
        AsyncElTable,
        {
          fit: false,
          tableLayout: 'auto',
          ...attrs
        },
        slots
      );
  }
});

const components: Array<[string, ComponentLoader]> = [
  [
    'ElAlert',
    () => import('element-plus/es/components/alert/index.mjs').then((module) => module.ElAlert)
  ],
  [
    'ElBadge',
    () => import('element-plus/es/components/badge/index.mjs').then((module) => module.ElBadge)
  ],
  [
    'ElButton',
    () => import('element-plus/es/components/button/index.mjs').then((module) => module.ElButton)
  ],
  [
    'ElCheckbox',
    () =>
      import('element-plus/es/components/checkbox/index.mjs').then((module) => module.ElCheckbox)
  ],
  [
    'ElCheckboxGroup',
    () =>
      import('element-plus/es/components/checkbox/index.mjs').then(
        (module) => module.ElCheckboxGroup
      )
  ],
  [
    'ElCollapse',
    () =>
      import('element-plus/es/components/collapse/index.mjs').then((module) => module.ElCollapse)
  ],
  [
    'ElCollapseItem',
    () =>
      import('element-plus/es/components/collapse/index.mjs').then(
        (module) => module.ElCollapseItem
      )
  ],
  [
    'ElDatePicker',
    () =>
      import('element-plus/es/components/date-picker/index.mjs').then(
        (module) => module.ElDatePicker
      )
  ],
  [
    'ElDescriptions',
    () =>
      import('element-plus/es/components/descriptions/index.mjs').then(
        (module) => module.ElDescriptions
      )
  ],
  [
    'ElDescriptionsItem',
    () =>
      import('element-plus/es/components/descriptions/index.mjs').then(
        (module) => module.ElDescriptionsItem
      )
  ],
  [
    'ElDialog',
    () => import('element-plus/es/components/dialog/index.mjs').then((module) => module.ElDialog)
  ],
  [
    'ElDivider',
    () => import('element-plus/es/components/divider/index.mjs').then((module) => module.ElDivider)
  ],
  [
    'ElDrawer',
    () => import('element-plus/es/components/drawer/index.mjs').then((module) => module.ElDrawer)
  ],
  [
    'ElDropdown',
    () =>
      import('element-plus/es/components/dropdown/index.mjs').then((module) => module.ElDropdown)
  ],
  [
    'ElDropdownItem',
    () =>
      import('element-plus/es/components/dropdown/index.mjs').then(
        (module) => module.ElDropdownItem
      )
  ],
  [
    'ElDropdownMenu',
    () =>
      import('element-plus/es/components/dropdown/index.mjs').then(
        (module) => module.ElDropdownMenu
      )
  ],
  [
    'ElEmpty',
    () => import('element-plus/es/components/empty/index.mjs').then((module) => module.ElEmpty)
  ],
  [
    'ElForm',
    () => import('element-plus/es/components/form/index.mjs').then((module) => module.ElForm)
  ],
  [
    'ElFormItem',
    () => import('element-plus/es/components/form/index.mjs').then((module) => module.ElFormItem)
  ],
  [
    'ElIcon',
    () => import('element-plus/es/components/icon/index.mjs').then((module) => module.ElIcon)
  ],
  [
    'ElInput',
    () => import('element-plus/es/components/input/index.mjs').then((module) => module.ElInput)
  ],
  [
    'ElInputNumber',
    () =>
      import('element-plus/es/components/input-number/index.mjs').then(
        (module) => module.ElInputNumber
      )
  ],
  [
    'ElOption',
    () => import('element-plus/es/components/select/index.mjs').then((module) => module.ElOption)
  ],
  [
    'ElPagination',
    () =>
      import('element-plus/es/components/pagination/index.mjs').then(
        (module) => module.ElPagination
      )
  ],
  [
    'ElPopover',
    () => import('element-plus/es/components/popover/index.mjs').then((module) => module.ElPopover)
  ],
  [
    'ElProgress',
    () =>
      import('element-plus/es/components/progress/index.mjs').then((module) => module.ElProgress)
  ],
  [
    'ElRadioButton',
    () =>
      import('element-plus/es/components/radio/index.mjs').then((module) => module.ElRadioButton)
  ],
  [
    'ElRadioGroup',
    () => import('element-plus/es/components/radio/index.mjs').then((module) => module.ElRadioGroup)
  ],
  [
    'ElResult',
    () => import('element-plus/es/components/result/index.mjs').then((module) => module.ElResult)
  ],
  [
    'ElSelect',
    () => import('element-plus/es/components/select/index.mjs').then((module) => module.ElSelect)
  ],
  [
    'ElSkeleton',
    () =>
      import('element-plus/es/components/skeleton/index.mjs').then((module) => module.ElSkeleton)
  ],
  [
    'ElSwitch',
    () => import('element-plus/es/components/switch/index.mjs').then((module) => module.ElSwitch)
  ],
  [
    'ElTabPane',
    () => import('element-plus/es/components/tabs/index.mjs').then((module) => module.ElTabPane)
  ],
  ['ElTable', () => Promise.resolve(ElTableWithDefaults)],
  [
    'ElTableColumn',
    () =>
      import('element-plus/es/components/table/index.mjs').then((module) => module.ElTableColumn)
  ],
  [
    'ElTabs',
    () => import('element-plus/es/components/tabs/index.mjs').then((module) => module.ElTabs)
  ],
  [
    'ElTag',
    () => import('element-plus/es/components/tag/index.mjs').then((module) => module.ElTag)
  ],
  [
    'ElTooltip',
    () => import('element-plus/es/components/tooltip/index.mjs').then((module) => module.ElTooltip)
  ],
  [
    'ElTree',
    () => import('element-plus/es/components/tree/index.mjs').then((module) => module.ElTree)
  ]
];

export const elementPlusPlugin: Plugin = {
  install(app: App) {
    for (const [name, loadComponent] of components) {
      app.component(name, defineAsyncComponent(loadComponent));
    }

    app.use(ElLoading);
  }
};
