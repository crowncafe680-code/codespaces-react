import './App.css';
import RestaurantApp from './RestaurantApp';
import { useEffect, useState } from 'react';

function App() {
  const [installEvent, setInstallEvent] = useState(null);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleInstalled = () => setInstallEvent(null);
    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  if (window.location.pathname === '/restaurant') {
    return <RestaurantApp />;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img src="/Octocat.png" className="App-logo" alt="GitHub Octocat" />
        <p>
          GitHub Codespaces <span className="heart">♥️</span> React
        </p>
        <p className="small">
          عدّل <code>src/App.jsx</code> واحفظ الملف لتحديث الصفحة.
        </p>
        <p>
          <a
            className="App-link"
            href="https://react.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            تعلّم React
          </a>
        </p>
        <p className="small">
          <a className="App-link" href="/restaurant">فتح نظام المطعم</a>
        </p>
        {installEvent && (
          <button className="install-app-button" type="button" onClick={installApp}>
            تثبيت التطبيق
          </button>
        )}
        <p className="small install-hint">
          لتثبيته من Chrome: افتح القائمة ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».
        </p>
      </header>
    </div>
  );
}

export default App;
