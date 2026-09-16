import { NavLink, Route, Routes } from 'react-router-dom';
import { Icon } from './ui.tsx';
import OverviewPage from './pages/OverviewPage.tsx';
import BagPage from './pages/BagPage.tsx';
import ItemsPage from './pages/ItemsPage.tsx';

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <NavLink to="/" className="brand"><span className="brand-dot" />EDC Organizer</NavLink>
        <nav className="nav">
          <NavLink to="/" end><Icon name="bag" />Bags</NavLink>
          <NavLink to="/items"><Icon name="items" />Items</NavLink>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/bags/:id" element={<BagPage />} />
          <Route path="/items" element={<ItemsPage />} />
        </Routes>
      </main>
    </div>
  );
}
