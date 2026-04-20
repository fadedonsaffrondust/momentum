import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { queryClient } from './lib/queryClient';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AppShell } from './layout/AppShell';
import { TodayPage } from './pages/TodayPage';
import { BacklogPage } from './pages/BacklogPage';
import { ParkingsPage } from './pages/ParkingsPage';
import { BrandsPage } from './pages/BrandsPage';
import { TeamPage } from './pages/TeamPage';
import { InboxPage } from './pages/InboxPage';
import { JarvisPage } from './jarvis/JarvisPage';
import { TasksLayout } from './layout/TasksLayout';
import { Protected } from './components/Protected';
import { CommandsProvider } from './lib/commands/context';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CommandsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route
              path="/"
              element={
                <Protected>
                  <AppShell />
                </Protected>
              }
            >
              <Route element={<TasksLayout />}>
                <Route index element={<TodayPage />} />
                <Route path="backlog" element={<BacklogPage />} />
              </Route>
              <Route path="parkings" element={<ParkingsPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="inbox" element={<InboxPage />} />
              <Route path="brands" element={<BrandsPage />} />
              <Route path="brands/:id" element={<BrandsPage />} />
              <Route path="jarvis" element={<JarvisPage />} />
              <Route path="jarvis/:conversationId" element={<JarvisPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CommandsProvider>
    </QueryClientProvider>
  );
}
