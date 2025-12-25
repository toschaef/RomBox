import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout';
import Library from './pages/Library';
import Settings from './pages/Settings';
import Controls from './pages/Controls';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Library />} />
          <Route path="controls" element={<Controls />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}