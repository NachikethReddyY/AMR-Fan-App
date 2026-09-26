import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import {
  NavigationContainer,
  DarkTheme,
  useFocusEffect,
} from '@react-navigation/native';
import {
  createBottomTabNavigator,
  type BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';
import {
  ArrowRight,
  Gift,
  House,
  Leaf,
  Route,
  type LucideIcon,
} from 'lucide-react-native';
import {
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

import { GluestackUIProvider } from '@/components/ui/gluestack-ui-provider';
import '../global.css';
import { AccountProvider } from './features/account/provider';
import { AccountPanel } from './features/account/AccountPanel';
import { PointsProvider, useHistory } from './features/points/provider';
import { Balance } from './features/points/Balance';
import { Action, Text } from './features/points/controls';
import { RewardsScreen as PointsRewards } from './features/points/RewardsScreen';

import { TravelScreen as TravelComparison } from './features/routes/TravelScreen';
import { ImpactScreen as OfficialImpact } from './features/impact/ImpactScreen';
import { useProfileContext } from './features/account/useResource';

type Tabs = {
  Home: undefined;
  Travel: undefined;
  Rewards: undefined;
  Impact: undefined;
};
const Tab = createBottomTabNavigator<Tabs>();

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.selectedTabIcon]}>
      <Icon color={focused ? '#04524B' : '#E0E0DC'} size={22} strokeWidth={2} />
    </View>
  );
}

function Home({
  onTravel,
  onRewards,
  onImpact,
}: {
  onTravel: () => void;
  onRewards: () => void;
  onImpact: () => void;
}) {
  const { controller } = useHistory();
  const { fontScale } = useWindowDimensions();
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  return (
    <>
      <View style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Available points</Text>
        <Balance prominent />
      </View>
      <View style={styles.homeContent}>
        <Action
          secondary
          label="View rewards and History"
          onPress={onRewards}
        />
        <View
          style={[styles.impactGroup, fontScale > 1.3 && styles.impactStack]}
        >
          <View style={styles.impactItem}>
            <Text style={styles.caption}>Your verified impact</Text>
            <Text style={styles.unavailable}>Unavailable</Text>
          </View>
          <View style={styles.impactItem}>
            <Text style={styles.caption}>Community impact</Text>
            <Text style={styles.unavailable}>Unavailable</Text>
          </View>
        </View>
        <Text style={styles.muted}>
          Points are separate from impact. Demo balances stay in the demo
          profile.
        </Text>
        <View style={styles.travelEntry}>
          <Text style={styles.sectionTitle}>Where are you going?</Text>
          <Text>Compare routes between places in Singapore.</Text>
          <Action label="Compare routes" icon={ArrowRight} onPress={onTravel} />
        </View>
        <Action
          secondary
          label="Read approved team figures"
          onPress={onImpact}
        />
      </View>
    </>
  );
}

function Screen({
  children,
  compactAccount = false,
}: {
  children: React.ReactNode;
  compactAccount?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: 24 },
        ]}
      >
        {compactAccount ? (
          <View style={styles.brandHeader}>
            <View style={styles.brandCopy}>
              <Text key={fontScale} style={styles.brandName}>
                Aston Martin
              </Text>
              <Text style={styles.caption}>Fan app</Text>
            </View>
            <AccountPanel compact />
          </View>
        ) : (
          <Text key={fontScale} style={styles.appName}>
            AMR Fan App
          </Text>
        )}
        {children}
      </ScrollView>
    </View>
  );
}

function HomeScreen({ navigation }: BottomTabScreenProps<Tabs, 'Home'>) {
  return (
    <Screen compactAccount>
      <Home
        onTravel={() => navigation.navigate('Travel')}
        onRewards={() => navigation.navigate('Rewards')}
        onImpact={() => navigation.navigate('Impact')}
      />
    </Screen>
  );
}
function TravelScreen() {
  const ctx = useProfileContext();
  return (
    <Screen compactAccount>
      {ctx ? (
        <TravelComparison key={`${ctx.token}:${ctx.profileId}`} />
      ) : (
        <View style={styles.section}>
          <Text style={styles.muted}>Sign in to compare routes.</Text>
        </View>
      )}
    </Screen>
  );
}
function RewardsScreen() {
  return (
    <Screen>
      <PointsRewards />
    </Screen>
  );
}
function ImpactScreen() {
  const ctx = useProfileContext();
  return (
    <Screen>
      <AccountPanel />
      {ctx ? (
        <OfficialImpact key={`${ctx.token}:${ctx.profileId}`} />
      ) : (
        <View style={styles.section}>
          <Text style={styles.muted}>
            Sign in to read approved team figures.
          </Text>
        </View>
      )}
    </Screen>
  );
}

function AccountNavigation() {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const largeLabels = fontScale > 1.3;
  const [labelHeights, setLabelHeights] = useState<Record<string, number>>({});
  const labelHeight = Math.max(14 * fontScale, ...Object.values(labelHeights));
  return (
    <AccountProvider>
      <PointsProvider>
        <NavigationContainer
          theme={{
            ...DarkTheme,
            colors: { ...DarkTheme.colors, background: '#121212' },
          }}
        >
          <Tab.Navigator
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: '#FFFFFF',
              tabBarInactiveTintColor: '#E0E0DC',
              ...(largeLabels
                ? {
                    tabBarLabel: ({ color, children }) => (
                      <Text
                        style={{
                          color,
                          fontSize: 12,
                          lineHeight: 14,
                          textAlign: 'center',
                          paddingHorizontal: 2,
                          maxWidth: '100%',
                        }}
                        accessibilityElementsHidden
                        importantForAccessibility="no"
                        onLayout={({ nativeEvent }) => {
                          const { height } = nativeEvent.layout;
                          setLabelHeights((previous) =>
                            previous[children] === height
                              ? previous
                              : { ...previous, [children]: height },
                          );
                        }}
                      >
                        {children}
                      </Text>
                    ),
                  }
                : {}),
              tabBarStyle: {
                backgroundColor: '#04524B',
                borderTopColor: '#3D3D3D',
                ...(largeLabels
                  ? { height: 44 + labelHeight + insets.bottom }
                  : {}),
              },
            }}
          >
            <Tab.Screen
              name="Home"
              component={HomeScreen}
              options={{
                tabBarAccessibilityLabel: 'Home, tab, 1 of 4',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={House} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Travel"
              component={TravelScreen}
              options={{
                tabBarAccessibilityLabel: 'Travel, tab, 2 of 4',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={Route} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Rewards"
              component={RewardsScreen}
              options={{
                tabBarAccessibilityLabel: 'Rewards, tab, 3 of 4',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={Gift} focused={focused} />
                ),
              }}
            />
            <Tab.Screen
              name="Impact"
              component={ImpactScreen}
              options={{
                tabBarAccessibilityLabel: 'Impact, tab, 4 of 4',
                tabBarIcon: ({ focused }) => (
                  <TabIcon Icon={Leaf} focused={focused} />
                ),
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </PointsProvider>
    </AccountProvider>
  );
}

export default function App() {
  return (
    <GluestackUIProvider mode="dark">
      <SafeAreaProvider>
        <AccountNavigation />
      </SafeAreaProvider>
    </GluestackUIProvider>
  );
}

const styles = StyleSheet.create({
  tabIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTabIcon: { backgroundColor: '#D8DBD8' },
  screen: { flex: 1, backgroundColor: '#121212' },
  content: { minHeight: '100%' },
  appName: {
    color: '#F5F5F3',
    fontSize: 17,
    fontWeight: '600',
    marginHorizontal: 20,
    marginBottom: 22,
  },
  brandHeader: {
    marginHorizontal: 20,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandCopy: { flex: 1 },
  brandName: { fontSize: 22, lineHeight: 28, fontFamily: 'Geist_600SemiBold' },
  balancePanel: { backgroundColor: '#04524B', padding: 20, gap: 12 },
  balanceLabel: { color: '#F5F5F3', fontSize: 17 },
  homeContent: { marginHorizontal: 20, paddingVertical: 20, gap: 20 },
  impactGroup: {
    flexDirection: 'row',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#3D3D3D',
    paddingTop: 20,
  },
  impactStack: { flexDirection: 'column' },
  impactItem: { flex: 1, gap: 8 },
  caption: { color: '#A9A9A3', fontSize: 14, lineHeight: 20 },
  unavailable: { fontFamily: 'Geist_600SemiBold' },
  travelEntry: {
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#3D3D3D',
    paddingTop: 20,
  },
  section: { marginHorizontal: 20, paddingVertical: 26 },
  sectionTitle: {
    color: '#F5F5F3',
    fontSize: 22,
    lineHeight: 28,
    fontFamily: 'Geist_600SemiBold',
  },
  muted: { color: '#A9A9A3', fontSize: 17, lineHeight: 25 },
});
