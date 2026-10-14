import './App.css'
import HomePage from './pages/HomePage';
import SoundBoard from './components/SoundBoard';
import Cursor from './components/Cursor';
import CrtOverlay from './components/CrtOverlay';
import Arcade from './arcade/Arcade';

// the original portfolio isn't in any arcade machine, it's shown on its own
const STANDALONE_PATH = "/old"

function App() {
  const standalone = window.location.pathname === STANDALONE_PATH

  return (<>
    <SoundBoard />
    <Cursor />
    { standalone && <>
      <CrtOverlay />
      <HomePage />
    </> }
    { !standalone && <Arcade /> }
  </>
  );
}

export default App
