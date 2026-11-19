import './styles/main.css';
import { mountApp } from './app.js';

const app = mountApp(document.querySelector('#app'));
if (import.meta.hot) import.meta.hot.dispose(() => app.destroy());
