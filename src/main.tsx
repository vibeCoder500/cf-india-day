import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './lib/client'; // open the socket immediately so it is warm when the splash ends
import { installFun } from './lib/fun';
import App from './App';

installFun();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
