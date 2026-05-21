import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout';
import Library from './components/pages/Library';
import Settings from './components/pages/Settings';
import Controls from './components/pages/Controls';
import Engines from './components/pages/Engines';
import Bios from './components/pages/Bios';
import { NotificationProvider } from './hooks/useNotifications';
import NotificationContainer from './components/NotificationContainer';

export default function App() {
  return (
    <NotificationProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Library />} />
            <Route path="controls" element={<Controls />} />
            <Route path="engines" element={<Engines />} />
            <Route path="bios" element={<Bios />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
      <NotificationContainer />
    </NotificationProvider>
  );
}