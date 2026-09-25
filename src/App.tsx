import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Gift, House, Leaf, Route, type LucideIcon } from 'lucide-react-native';
import {
  ScrollView,
  StyleSheet,
  Text,
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

function Home() {
  return (
    <>
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Fan and race updates</Text>
        <Text style={styles.heroTitle}>{'Latest from\nthe team'}</Text>
        <Text style={styles.heroDetail}>Published updates appear here</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Points and rewards</Text>
        <Text style={styles.points}>
          0 <Text style={styles.muted}>available points</Text>
        </Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Team impact</Text>
        <Text style={styles.muted}>
          Sourced team activity and your contribution record appear here.
        </Text>
      </View>
    </>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: 24 },
        ]}
      >
        <Text style={styles.appName}>AMR Fan App</Text>
        {children}
      </ScrollView>
    </View>
  );
}

function HomeScreen() {
  return (
    <Screen>
      <AccountPanel />
      <Home />
    </Screen>
  );
}
function TravelScreen() {
  return <Placeholder title="Travel" />;
}
function RewardsScreen() {
  return <Placeholder title="Rewards" />;
}
function ImpactScreen() {
  return <Placeholder title="Impact" />;
}

function Placeholder({ title }: { title: string }) {
  return (
    <Screen>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.muted}>{title} content is coming soon.</Text>
      </View>
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
  hero: {
    minHeight: 235,
    backgroundColor: '#083E3B',
    paddingHorizontal: 20,
    paddingVertical: 22,
    justifyContent: 'flex-end',
  },
  heroLabel: { color: '#DDE7E2', fontSize: 14 },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 32,
    lineHeight: 35,
    fontWeight: '600',
    marginTop: 8,
  },
  heroDetail: { color: '#DDE7E2', fontSize: 14, marginTop: 8 },
  section: {
    marginHorizontal: 20,
    paddingVertical: 26,
    borderBottomWidth: 1,
    borderBottomColor: '#3D3D3D',
  },
  sectionTitle: {
    color: '#F5F5F3',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  points: { color: '#F5F5F3', fontSize: 36, fontWeight: '600' },
  muted: { color: '#B8BCB9', fontSize: 15, lineHeight: 22 },
  placeholder: { marginHorizontal: 20, paddingTop: 34 },
  placeholderTitle: {
    color: '#F5F5F3',
    fontSize: 30,
    fontWeight: '600',
    marginBottom: 12,
  },
});
