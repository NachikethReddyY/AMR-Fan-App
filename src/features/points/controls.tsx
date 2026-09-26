import { createContext, useContext, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text as NativeText,
  type TextProps,
  useWindowDimensions,
} from 'react-native';

const BoldText = createContext(false);
export function PointsTextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [bold, setBold] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isBoldTextEnabled().then(setBold);
    const listener = AccessibilityInfo.addEventListener(
      'boldTextChanged',
      setBold,
    );
    return () => listener.remove();
  }, []);
  return <BoldText.Provider value={bold}>{children}</BoldText.Provider>;
}
export function Text(props: TextProps) {
  const bold = useContext(BoldText);
  const { fontScale } = useWindowDimensions();
  // Renew the native paragraph's cached measurement, not its owning screen.
  return (
    <NativeText
      key={fontScale}
      {...props}
      style={[
        styles.text,
        props.style,
        bold && { fontFamily: 'Geist_600SemiBold' },
      ]}
    />
  );
}
export function Action({
  label,
  disabled = false,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  text: {
    color: '#E0E0DC',
    fontSize: 17,
    lineHeight: 25,
    fontFamily: 'Geist_400Regular',
  },
  button: {
    minHeight: 48,
    backgroundColor: '#04524B',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
  },
  label: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    textAlign: 'center',
  },
});
