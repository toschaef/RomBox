import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout';
import Library from './components/pages/Library';
import Settings from './components/pages/Settings';
import Controls from './components/pages/Controls';

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