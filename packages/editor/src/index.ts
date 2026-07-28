export { ProductEditor } from './components/ProductEditor.js';
export { SidebarPanel } from './components/sidebar/SidebarPanel.js';
export { Toolbar } from './components/Toolbar.js';
/** Optional wrapper that catches render errors in its subtree and shows a reload fallback instead of a blank screen — wrap `<ProductEditor/>` with it if desired. */
export { ErrorBoundary } from './components/ErrorBoundary.js';
export { useEditorStore } from './store/editorStore.js';
export type { CartItem } from './store/editorStore.js';
export { useI18nStore, useT } from './i18n/useTranslation.js';
/** Thin fetch wrappers for the backend REST API (products, designs, asset uploads) used internally by the editor; exported for advanced integrations that need direct access. */
export * as api from './services/api.js';
