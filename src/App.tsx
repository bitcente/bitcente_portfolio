import './App.css'
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import HomePage from './pages/HomePage';
import PokemonGameBoy from './pages/PokemonPage/PokemonPage';
import ShowcasePage from './pages/ShowcasePage/ShowcasePage';
import SoundBoard from './components/SoundBoard';
import Cursor from './components/Cursor';
import CrtOverlay from './components/CrtOverlay';

const router = createBrowserRouter([
  {
    path: "/",
    element: <HomePage/>,
  },
  {
    path: "/showcase",
    element: <ShowcasePage/>,
  },
  {
    path: "/pokemon",
    element: <PokemonGameBoy/>,
  },
])

function App() {

  return (<>
    <SoundBoard />
    <Cursor />
    <CrtOverlay />
    <RouterProvider router={router} />
  </>
  );
}

export default App
