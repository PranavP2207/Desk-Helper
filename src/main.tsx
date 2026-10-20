import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import Widget from './Widget';
import './styles.css';
import './widget.css';

const surface = new URLSearchParams(location.search).get('surface') ?? 'library';
document.documentElement.dataset.surface = surface;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{surface === 'widget' ? <Widget /> : <App />}</React.StrictMode>);
