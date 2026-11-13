// Browser test entry only; not part of the production build or route tree.
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import LandingPage from '../../src/pages/public/LandingPage';
import '../../src/index.css';

createRoot(document.getElementById('root')).render(<BrowserRouter><LandingPage mapConfig={{ apiKey: 'provider-stub-only', mapId: 'provider-stub-only' }} /></BrowserRouter>);
