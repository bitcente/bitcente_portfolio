import './App.css'
import HomePage from './pages/HomePage';
import SoundBoard from './components/SoundBoard';
import Cursor from './components/Cursor';
import CrtOverlay from './components/CrtOverlay';
import Arcade from './arcade/Arcade';
import MuteButton, { useMuteKey } from './components/MuteButton';
import { cleanPath } from './arcade/layout';

// the original portfolio isn't in any arcade machine, it's shown on its own
const STANDALONE_PATH = "/old"

function App() {
  const standalone = cleanPath(window.location.pathname) === STANDALONE_PATH

  useMuteKey()

  return (<>
    <SoundBoard />
    <Cursor />
    { standalone && <>
      <MuteButton />
      <CrtOverlay />
      <HomePage />
    </> }
    { !standalone && <Arcade /> }
  </>
  );
}

export default App
