
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

console.log("Joselito App: Iniciando montaje del DOM...");
fetch('/api/health-v2?from=index-tsx').then(r => console.log('index.tsx health check:', r.status));

const rootElement = document.getElementById('root');

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: '50px', textAlign: 'center', fontFamily: 'sans-serif', background: '#fff', height: '100vh'}}>
          <h1 style={{color: 'red'}}>ERROR CRÍTICO DE REACT</h1>
          <div style={{background: '#fee2e2', padding: '20px', borderRadius: '8px', textAlign: 'left', margin: '20px auto', maxWidth: '600px', overflow: 'auto'}}>
            <code>{this.state.error?.message || 'Error desconocido'}</code>
          </div>
          <button onClick={() => window.location.reload()} style={{padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer'}}>
            Recargar Aplicación
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

if (!rootElement) {
  console.error("Joselito App: Error Crítico - No se encontró el elemento raíz.");
} else {
  const safetyTimeout = setTimeout(() => {
    if (rootElement.innerHTML.includes('Iniciando Joselito Cloud')) {
      console.error("Joselito App: Safety timeout hit.");
      rootElement.innerHTML = `<div style="padding:50px; text-align:center; font-family:sans-serif; background:white; height:100vh;"><h1>TIEMPO DE ESPERA AGOTADO</h1><p>La aplicación tarda demasiado en cargar. Revisa la consola (F12).</p><button onclick="location.reload()">Reintentar</button></div>`;
    }
  }, 8000);

  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
    clearTimeout(safetyTimeout);
    console.log("Joselito App: React montado correctamente.");
  } catch (error: any) {
    clearTimeout(safetyTimeout);
    console.error("Joselito App: Error durante el renderizado inicial:", error);
    rootElement.innerHTML = `<div style="padding:50px; text-align:center; font-family:sans-serif; background:white; height:100vh;"><h1 style="color:red;">ERROR DE MONTAJE</h1><p>${error?.message}</p></div>`;
  }
}
