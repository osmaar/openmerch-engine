import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { useI18nStore } from './i18n/useTranslation.js';
import { Dashboard } from './pages/Dashboard.js';
import { Products } from './pages/Products.js';
import { ProductEdit } from './pages/ProductEdit.js';
import { Designs } from './pages/Designs.js';
import { Templates } from './pages/Templates.js';
import { Cliparts } from './pages/Cliparts.js';
import { Shapes } from './pages/Shapes.js';
import { PrintingTypes } from './pages/PrintingTypes.js';
import { Fonts } from './pages/Fonts.js';
import { Languages } from './pages/Languages.js';
import { Orders } from './pages/Orders.js';
import { SettingsPage } from './pages/SettingsPage.js';

export function App() {
  const loadLanguages = useI18nStore((s) => s.loadLanguages);

  useEffect(() => {
    loadLanguages();
  }, [loadLanguages]);

  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
