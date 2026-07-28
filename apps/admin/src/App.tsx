import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Center, Loader } from '@mantine/core';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { Layout } from './components/Layout.js';
import { useI18nStore, useT } from './i18n/useTranslation.js';
import { Dashboard } from './pages/Dashboard.js';

const Products = lazy(() => import('./pages/Products.js').then((m) => ({ default: m.Products })));
const ProductEdit = lazy(() => import('./pages/ProductEdit.js').then((m) => ({ default: m.ProductEdit })));
const Designs = lazy(() => import('./pages/Designs.js').then((m) => ({ default: m.Designs })));
const Templates = lazy(() => import('./pages/Templates.js').then((m) => ({ default: m.Templates })));
const Cliparts = lazy(() => import('./pages/Cliparts.js').then((m) => ({ default: m.Cliparts })));
const Shapes = lazy(() => import('./pages/Shapes.js').then((m) => ({ default: m.Shapes })));
const PrintingTypes = lazy(() => import('./pages/PrintingTypes.js').then((m) => ({ default: m.PrintingTypes })));
const Fonts = lazy(() => import('./pages/Fonts.js').then((m) => ({ default: m.Fonts })));
const Languages = lazy(() => import('./pages/Languages.js').then((m) => ({ default: m.Languages })));
const Orders = lazy(() => import('./pages/Orders.js').then((m) => ({ default: m.Orders })));
const SettingsPage = lazy(() => import('./pages/SettingsPage.js').then((m) => ({ default: m.SettingsPage })));

function RouteFallback() {
  const t = useT();

  return (
    <Center h="100%" mih={200}>
      <Loader aria-label={t('Loading...')} />
    </Center>
  );
}

export function App() {
  const loadLanguages = useI18nStore((s) => s.loadLanguages);

  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="products" element={<Products />} />
              <Route path="products/new" element={<ProductEdit />} />
              <Route path="products/:id/edit" element={<ProductEdit />} />
              <Route path="designs" element={<Designs />} />
              <Route path="templates" element={<Templates />} />
              <Route path="cliparts" element={<Cliparts />} />
              <Route path="shapes" element={<Shapes />} />
              <Route path="fonts" element={<Fonts />} />
              <Route path="printing" element={<PrintingTypes />} />
              <Route path="orders" element={<Orders />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="settings/languages" element={<Languages />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
