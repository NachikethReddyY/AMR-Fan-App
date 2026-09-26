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
  accent = false,
  quiet = false,
  icon: Icon,
}: {
  label: string;
  disabled?: boolean;
  onPress: () => void;
  secondary?: boolean;
  accent?: boolean;
  quiet?: boolean;
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
        accent && styles.accent,
        quiet && styles.quiet,
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.75 },
      ]}
    >
      <Text
        style={[
          styles.label,
          accent && !disabled && styles.accentLabel,
          quiet && styles.quietLabel,
        ]}
      >
        {label}
      </Text>
      {Icon && (
        <Icon
          size={20}
          color={quiet ? '#CEDC00' : '#F5F5F3'}
          accessible={false}
        />
      )}
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
    backgroundColor: '#004A4D',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 26,
    flexDirection: 'row',
    gap: 10,
  },
  secondary: {
    backgroundColor: '#222222',
    borderColor: '#3D3D3D',
    borderWidth: 1,
    borderRadius: 26,
  },
  quiet: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    justifyContent: 'space-between',
    borderRadius: 0,
  },
  quietLabel: { color: '#CEDC00', textAlign: 'left' },
  accent: { backgroundColor: '#004A4D', borderRadius: 26 },
  accentLabel: { color: '#F5F5F3' },
  disabled: { backgroundColor: '#3A3A3A' },
  label: {
    color: '#F5F5F3',
    fontFamily: 'Geist_600SemiBold',
    textAlign: 'center',
    flexShrink: 1,
  },
});
