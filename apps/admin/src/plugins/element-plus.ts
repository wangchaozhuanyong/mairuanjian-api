import { defineAsyncComponent, type App, type Component, type Plugin } from 'vue';
import { ElLoading } from 'element-plus/es/components/loading/index.mjs';

type ComponentLoader = () => Promise<Component>;

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
  [
    'ElTable',
    () => import('element-plus/es/components/table/index.mjs').then((module) => module.ElTable)
  ],
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
