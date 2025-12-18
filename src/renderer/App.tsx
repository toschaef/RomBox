import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout';
import Library from './views/Library';
import Settings from './views/Settings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Library />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}