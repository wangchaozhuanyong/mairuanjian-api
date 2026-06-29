# Responsive Layout QA Report

## 1. Checked pages

- Login: /login
- Dashboard: /dashboard
- Apple accounts: /apple/accounts
- Apple order entry: /apple/order-entry
- Apple automation tasks: /apple/automation
- Code inventory: /codes/inventory
- Code orders: /codes/orders
- Customers: /customers
- Source platforms: /system/source-platforms/platforms
- Users: /system/users
- Roles: /system/roles
- Audit logs: /system/audit-logs
- Notifications: /system/notifications

Evidence folder: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28
Machine results: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/responsive-layout-qa-results.json

## 2. Checked viewports

- 375px
- 390px
- 414px
- 768px
- 1024px
- desktop 1440px

Total screenshots: 86. Browser run used a local authenticated QA session and read-only mock API responses to keep the audit focused on frontend layout.

## 3. Visual collision issues

### Confirmed

1. Users create dialog at 375px height has bottom content pressure.
   - Evidence: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/375px/users-overlay.png
   - The Role select is partially pushed into the fixed dialog footer area on 375x812. It is better at 414x896.
   - Risk: mobile users may think the last field is disabled or hidden.

2. Topbar search collapses into a blank small control on 1024px Apple order entry.
   - Evidence: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/1024px/apple-order-entry.png
   - The page has several actions in the topbar. At 1024px, the global search input loses useful width and appears like an empty rounded square.
   - Risk: navigation/search affordance looks broken on narrow desktop or landscape tablet.

### Not confirmed / likely false positives

- Help icons are 18px and workspace tab close icons are small, but no visible overlap was found in screenshots.
- Some automated overlap candidates were caused by modal overlay stacking over the dimmed page behind it, not by visible content collision.

## 4. Overflow issues

### Confirmed

1. Source platform option navigation is horizontally clipped on mobile.
   - Evidence: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/375px/source-platforms.png
   - There is no page-level horizontal scroll, so layout is not broken. But the tab row depends on horizontal swipe and the off-screen options are not obvious.

2. Notification tabs are horizontally clipped on 375px.
   - Evidence: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/375px/notifications.png
   - Similar to Source platforms: not a hard overflow bug, but discoverability is weak.

### Cleared

- No document-level horizontal overflow was detected across checked viewports.
- Code orders, code inventory, customers, users, roles, audit logs and dashboard did not create body horizontal scroll in checked states.

## 5. Navigation issues

### Confirmed

1. 1024px topbar action density issue on action-heavy pages.
   - Primary evidence: Apple order entry 1024px.
   - The same breakpoint should be checked for any page that registers multiple PageActionsPortal actions.

### Cleared

- Mobile sidebar opens correctly at 375px, 390px, and 414px.
- Sidebar overlay, mask, nav grouping, and operator panel do not exceed viewport.
- 768px tablet view hides global search and remains usable.

## 6. Table issues

### Cleared in this run

- No table produced page-level horizontal overflow.
- Mobile list/empty states for Code orders and related list pages remain usable.
- Desktop and 1024px table wrappers stayed contained.

### Evidence limit

- API responses were mocked empty, so filled rows with long customer names, long platform order numbers, long Apple ID emails, long SKU names, and long remarks still need a data-rich pass.

## 7. Form issues

### Confirmed

1. Login empty submission validates correctly.
   - Evidence: /Users/wangchao/Desktop/源码文件夹/ai软件代充管理软件/qa-artifacts/responsive-layout-2026-06-28/375px/login-validation.png
   - Empty username/password show validation messages.

2. Users create dialog bottom field pressure at 375px.
   - Same issue as section 3.

### Cleared

- Apple order entry form reflows to single column on 375px and two-column on tablet/desktop without visible overlap.
- Main filter forms wrap cleanly on 375px for Code orders, Code inventory, Customers, Users and Source platforms.

## 8. Modal issues

### Confirmed

1. Users create dialog needs mobile bottom spacing/scroll treatment at 375px.
   - Footer stays visible, but the last field sits too close to or under the footer.

### Cleared

- No checked dialog/drawer exceeded viewport width.
- Dashboard status drawer on desktop is within bounds.

## 9. Button issues

### Confirmed risks

1. Workspace tab close button is only around 16x26 in many mobile/tablet views.
   - It is visually tidy but below comfortable touch target size.
   - Risk is higher on mobile because it sits near the tab title and page action row.

2. Help tooltip triggers are visually around 18x18.
   - These are repeated across forms/cards/page titles.
   - Not a layout blocker, but below common touch target guidance for mobile.

### Cleared

- Primary actions like Submit order, Save, Refresh, Export, Add user and clear filter are not visually clipped in checked screenshots.

## 10. Safe auto-fix issues

These can be fixed without touching business logic, API, DB, or copy:

1. Topbar responsive rule for action-heavy pages.
   - At 1024px, hide or collapse global search when PageActionsPortal has multiple actions, or give action group wrapping priority.
   - Keep desktop search normal at wider widths.

2. Users dialog mobile footer spacing.
   - Add mobile dialog body max-height and bottom padding equal to footer height.
   - Ensure the dialog content area scrolls independently above the footer.

3. Mobile tab overflow affordance for Source platforms and Notifications.
   - Add stronger horizontal scroll styling, fade edge, or visible overflow cue.
   - Do not change tab labels or page copy.

4. Workspace tab close hit area.
   - Increase clickable area with padding/min-size while keeping the visual icon compact.

5. Help icon touch target.
   - Increase interactive hit area around the icon without changing the visible icon size.

## 11. Need-confirmation issues

1. Whether to keep global search visible at 1024px on all pages or hide it on action-heavy pages only.
2. Whether mobile tabs should become segmented dropdowns instead of horizontal scrolling.
3. Whether workspace tabs should remain visible on mobile. They work, but consume meaningful first-screen height.
4. Whether to run a second pass against real seeded API data. This is needed to validate long-table-row behavior.

## 12. Suggested fix order

1. Fix 1024px topbar search collapse on action-heavy pages.
2. Fix 375px Users create dialog bottom spacing.
3. Improve mobile horizontal tab affordance for Source platforms and Notifications.
4. Enlarge workspace tab close and help-icon hit areas.
5. Re-run QA against seeded real data for long table cells and populated states.

## Checks run

- Read AGENTS.md and docs/ARCHITECTURE.md.
- npm run typecheck --workspace @apple-business/admin: passed.
- npm run build --workspace @apple-business/admin: passed.
- Playwright visual sweep: 86 screenshots across 13 pages and 6 viewport classes.

## Evidence limits

- Backend data was mocked with safe empty responses. This avoids writes and lets layout render, but does not prove populated table rows are perfect.
- Console contained expected EventSource MIME errors because realtime SSE was mocked as JSON during this read-only QA run.
- Some Vue warnings/pageerrors came from generic mock shapes and should be rechecked with real seeded API data before treating them as production bugs.
