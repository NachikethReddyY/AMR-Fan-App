import { StatusBar } from 'expo-status-bar';
import { Onboarding } from './features/onboarding/Onboarding';
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
  ChevronRight,
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
import { AccountProvider, useAccount } from './features/account/provider';
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
  Rewards: { section?: 'History' | 'Redemption' } | undefined;
  Impact: undefined;
};
const Tab = createBottomTabNavigator<Tabs>();

function TabIcon({ Icon, focused }: { Icon: LucideIcon; focused: boolean }) {
  return (
    <View style={[styles.tabIcon, focused && styles.selectedTabIcon]}>
      <Icon color={focused ? '#CEDC00' : '#ADBDB3'} size={22} strokeWidth={2} />
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
  useFocusEffect(
    useCallback(() => {
      void controller.refresh();
    }, [controller]),
  );
  return (
    <>
      <View style={styles.balancePanel}>
        <Text style={styles.balanceLabel}>Points balance</Text>
        <Balance prominent />
        <Action quiet label="History" icon={ChevronRight} onPress={onRewards} />
      </View>
      <View style={styles.homeContent}>
        <View style={styles.travelEntry}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Your next journey
          </Text>
          <Text style={styles.muted}>Compare time and emissions.</Text>
          <Action
            accent
            label="Plan a journey"
            icon={ArrowRight}
            onPress={onTravel}
          />
        </View>
        <View style={styles.impactGroup}>
          <View style={styles.impactItem}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Your impact
            </Text>
            <Text style={styles.muted}>Impact unavailable</Text>
          </View>
          <View style={styles.impactItem}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Community impact
            </Text>
            <Text style={styles.muted}>Impact unavailable</Text>
          </View>
        </View>
        <Action
          quiet
          label="View impact"
          icon={ChevronRight}
          onPress={onImpact}
        />
      </View>
    </>
  );
}

function Screen({
  children,
  greeting = false,
}: {
  children: React.ReactNode;
  greeting?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const { state } = useAccount();
  const profile =
    state.kind === 'signedIn'
      ? state.account.profiles.find((p) => p.kind === state.selected)
      : undefined;
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: 24 },
        ]}
      >
        <View style={styles.brandHeader}>
          <View style={styles.brandCopy}>
            {greeting && profile ? (
              <>
                <Text style={styles.caption}>Hi,</Text>
                <Text key={fontScale} style={styles.brandName}>
                  {profile.displayName}
                </Text>
              </>
            ) : (
              <Text key={fontScale} style={styles.brandName}>
                Aston Martin
              </Text>
            )}
          </View>
          <AccountPanel compact />
        </View>
        {children}
      </ScrollView>
    </View>
  );
}

function HomeScreen({ navigation }: BottomTabScreenProps<Tabs, 'Home'>) {
  return (
    <Screen greeting>
      <Home
        onTravel={() => navigation.navigate('Travel')}
        onRewards={() => navigation.navigate('Rewards', { section: 'History' })}
        onImpact={() => navigation.navigate('Impact')}
      />
    </Screen>
  );
}
function TravelScreen() {
  const ctx = useProfileContext();
  return (
    <Screen>
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
function RewardsScreen({
  route,
  navigation,
}: BottomTabScreenProps<Tabs, 'Rewards'>) {
  return (
    <Screen>
      <PointsRewards
        section={route.params?.section ?? 'Redemption'}
        onSectionChange={(section) => navigation.setParams({ section })}
      />
    </Screen>
  );
}
function ImpactScreen() {
  const ctx = useProfileContext();
  return (
    <Screen>
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
        <Onboarding>
          <NavigationContainer
            theme={{
              ...DarkTheme,
              colors: { ...DarkTheme.colors, background: '#081310' },
            }}
          >
            <Tab.Navigator
              safeAreaInsets={{ bottom: 0 }}
              screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: '#CEDC00',
                tabBarInactiveTintColor: '#ADBDB3',
                tabBarLabelPosition: 'below-icon',
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
                  backgroundColor: '#14221C',
                  borderColor: '#344C40',
                  borderWidth: 1,
                  borderTopWidth: 1,
                  borderTopColor: '#344C40',
                  borderRadius: 32,
                  marginHorizontal: 16,
                  marginBottom: Math.max(insets.bottom, 8) + 8,
                  marginTop: 8,
                  paddingTop: 6,
                  paddingBottom: 8,
                  height: largeLabels ? 48 + labelHeight : 68,
                  elevation: 0,
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
        </Onboarding>
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
  selectedTabIcon: { backgroundColor: '#26382B' },
  screen: { flex: 1, backgroundColor: '#081310' },
  content: { minHeight: '100%' },
  brandHeader: {
    marginHorizontal: 20,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  brandCopy: { flex: 1 },
  brandName: { fontSize: 22, lineHeight: 28, fontFamily: 'Geist_600SemiBold' },
  balancePanel: {
    backgroundColor: '#004A4D',
    marginHorizontal: 20,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#344C40',
    borderRadius: 12,
  },
  balanceLabel: { color: '#ADBDB3', fontSize: 17 },
  homeContent: { marginHorizontal: 20, paddingVertical: 20, gap: 20 },
  impactGroup: {
    flexDirection: 'column',
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: '#3D3D3D',
    paddingTop: 20,
  },
  impactItem: { flex: 1, gap: 8 },
  caption: { color: '#A9A9A3', fontSize: 14, lineHeight: 20 },
  travelEntry: {
    gap: 16,
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
