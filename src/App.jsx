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

  return (
    <>
      <RestaurantApp />
      {installEvent && (
        <button className="install-app-button" type="button" onClick={installApp}>
          تثبيت التطبيق
        </button>
      )}
    </>
  );
}

export default App;
