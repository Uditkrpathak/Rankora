import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from './store';
import { useGetMeQuery } from './store/api/authApi';
import { setCredentials, setLoading } from './store/slices/authSlice';
import { AppRouter } from './app/router';
import { BusinessChatbot } from './components/chat/BusinessChatbot';

export const App: React.FC = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useSelector((state: RootState) => state.auth);

  const { data: meData, isError, isLoading: isMeLoading } = useGetMeQuery();

  useEffect(() => {
    if (meData?.data?.user) {
      dispatch(
        setCredentials({
          user: meData.data.user,
          workspaces: meData.data.workspaces,
          activeWorkspace: meData.data.workspaces?.[0],
          accessToken: '',
        })
      );
    } else if (isError) {
      dispatch(setLoading(false));
    }
  }, [meData, isError, dispatch]);

  if (isMeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-slate-900">
        <div className="flex flex-col items-center gap-3 p-6 rounded-xl bg-white border border-slate-200 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-brand-50 border border-brand-100 flex items-center justify-center">
            <span className="text-base font-bold text-brand-600">R</span>
          </div>
          <div className="text-center">
            <p className="text-xs font-bold text-slate-900">Rankora</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Initializing workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppRouter />

      {/* ── Floating AI Business Copilot Chatbot ────────────────────── */}
      {isAuthenticated && <BusinessChatbot />}
    </>
  );
};

export default App;
