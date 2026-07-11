import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route } from 'react-router-dom';
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AnimatedRoutes } from "@/components/AnimatedRoutes";
import { PageTransition } from "@/components/PageTransition";
import Home from "./pages/Home";
import RoomLobby from "./pages/RoomLobby";
import GamePlay from "./pages/GamePlay";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AnimatedRoutes>
            <Route path="/" data-genie-title="首页" data-genie-key="Home" element={<PageTransition transition="fade"><Home /></PageTransition>} />
            <Route path="/room/:code" data-genie-title="房间大厅" data-genie-key="Room" element={<PageTransition transition="slide-up"><RoomLobby /></PageTransition>} />
            <Route path="/play/:code" data-genie-title="游戏对局" data-genie-key="Play" element={<PageTransition transition="fade"><GamePlay /></PageTransition>} />
            <Route path="*" data-genie-key="NotFound" data-genie-title="Not Found" element={<PageTransition transition="fade"><NotFound /></PageTransition>} />
          </AnimatedRoutes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App
