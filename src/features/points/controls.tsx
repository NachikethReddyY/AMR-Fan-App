import { createContext, useContext, useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react-native';
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
  secondary = false,
  icon: Icon,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  secondary?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text style={styles.label}>{label}</Text>
      {Icon && <Icon size={20} color="#F5F5F3" accessible={false} />}
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
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    backgroundColor: '#222222',
    borderColor: '#3D3D3D',
    borderWidth: 1,
    borderRadius: 26,
  },
  disabled: { backgroundColor: '#3A3A3A' },
  label: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    textAlign: 'center',
    flexShrink: 1,
  },
});
