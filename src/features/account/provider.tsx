import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from 'react';
import { AppState } from 'react-native';
import {
  useFonts,
  Geist_400Regular,
  Geist_600SemiBold,
} from '@expo-google-fonts/geist';
import { api, storage } from './native-auth';
import { createSessionController } from './session';

const Context = createContext<ReturnType<
  typeof createSessionController
> | null>(null);
export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [fontsLoaded, fontError] = useFonts({
    Geist_400Regular,
    Geist_600SemiBold,
  });
  const [controller] = useState(() => createSessionController(api, storage));
  useEffect(() => {
    void controller.resume();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active' && controller.getState().kind === 'signedIn')
        void controller.resume();
    });
    return () => listener.remove();
  }, [controller]);
  if (!fontsLoaded && !fontError) return null;
  return <Context.Provider value={controller}>{children}</Context.Provider>;
}
export function useSessionController() {
  const controller = useContext(Context);
  if (!controller) throw new Error('AccountProvider is required.');
  return controller;
}
export function useAccount() {
  const controller = useSessionController();
  const state = useSyncExternalStore(controller.subscribe, controller.getState);
  return { controller, state };
}
