import { HashRouter, Routes, Route } from 'react-router-dom';
import AppShell from './app/AppShell';
import Library from './features/library/Library';
import Settings from './features/settings/Settings';
import Controls from './features/controls/Controls';
import Engines from './features/engines/Engines';
import Bios from './features/bios/Bios';
import { NotificationProvider } from './app/notifications/NotificationProvider';
import NotificationContainer from './app/notifications/NotificationContainer';

export default function App() {
  return (
    <NotificationProvider>
      <HashRouter>
        <Routes>
          <Route path="/" element={<AppShell />}>
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