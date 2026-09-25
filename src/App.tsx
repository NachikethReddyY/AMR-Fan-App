import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>AMR Fan App</Text>
      <Text style={styles.subtitle}>Development starter</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#101114',
    padding: 24,
  },
  title: { color: '#ffffff', fontSize: 24, fontWeight: '600' },
  subtitle: { color: '#a1a1aa', fontSize: 16, marginTop: 8 },
});
