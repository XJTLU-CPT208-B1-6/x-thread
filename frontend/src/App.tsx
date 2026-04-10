import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { clearAuthSession, getStoredAuthToken, syncUserFromProfile } from './lib/auth';
import { saveAiSettings } from './lib/ai-settings';
import HomeWorkspacePage from './pages/HomeWorkspacePage';
import GroupLobbyPage from './pages/GroupLobbyPage';
import AdminPage from './pages/AdminPage';
import LobbyPageV2 from './pages/LobbyPageV2Active';
import IceBreakPage from './pages/IceBreakPage';
import DiscussPageV2 from './pages/DiscussPageV2';
import ReviewPage from './pages/ReviewPage';
import AccountAiSettingsPageV2 from './pages/AccountAiSettingsPageV2';
import RoomHistoryPage from './pages/RoomHistoryPage';
import { accountService, authService } from './services/api-client';

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      if (!getStoredAuthToken()) {
        setBootstrapping(false);
        return;
      }

      try {
        const { user } = await authService.getMe();

        if (cancelled) {
          return;
        }

        if (user.isGuest) {
          clearAuthSession();
          return;
        }

        syncUserFromProfile(user);
        void accountService
          .getAiSettings()
          .then((settings) => {
            if (!cancelled) {
              saveAiSettings(settings);
            }
          })
          .catch(() => undefined);
      } catch {
        if (!cancelled) {
          clearAuthSession();
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  if (bootstrapping) {
    return <div className="min-h-screen bg-slate-950" />;
  }

  return (
    <Routes>
      <Route path="/" element={<HomeWorkspacePage />} />
      <Route path="/lobby" element={<GroupLobbyPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/room/:code/lobby" element={<LobbyPageV2 />} />
      <Route path="/room/:code/icebreak" element={<IceBreakPage />} />
      <Route path="/room/:code/discuss" element={<DiscussPageV2 />} />
      <Route path="/room/:code/history" element={<RoomHistoryPage />} />
      <Route path="/settings/ai" element={<AccountAiSettingsPageV2 />} />
      <Route path="/room/:code/ai-settings" element={<AccountAiSettingsPageV2 />} />
      <Route path="/room/:code/review" element={<ReviewPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
