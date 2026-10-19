import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '../theme/tokens';
import { NavIcon, type NavIconName } from './nav-icon';

const TABS: { href: string; label: string; icon: NavIconName }[] = [
  { href: '/', label: 'Overview', icon: 'home' },
  { href: '/budget', label: 'Budget', icon: 'list' },
];

const TRAILING_TABS: { href: string; label: string; icon: NavIconName }[] = [
  { href: '/credit', label: 'Credit', icon: 'card' },
  { href: '/settings', label: 'Settings', icon: 'sliders' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname === '/index';
  }
  return pathname === href || pathname.startsWith(`${String(href)}/`);
}

export function BottomTabBar() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { height: 84 + insets.bottom, paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => (
        <TabItem key={tab.label} {...tab} active={isActive(pathname, tab.href)} />
      ))}
      <View style={styles.item}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          onPress={() => router.push('/transactions/new' as Href)}
          style={styles.fab}>
          <NavIcon name="plus" color={colors.surface} size={24} />
        </Pressable>
      </View>
      {TRAILING_TABS.map((tab) => (
        <TabItem key={tab.label} {...tab} active={isActive(pathname, tab.href)} />
      ))}
    </View>
  );
}

function TabItem({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  active: boolean;
}) {
  const color = active ? colors.accent : colors.muted;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={() => router.push(href as Href)}
      style={styles.item}>
      <NavIcon name={icon} color={color} />
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing[8],
  },
  item: {
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[4],
  },
  label: {
    fontFamily: typography.family[600],
    fontSize: typography.size[12],
  },
  fab: {
    width: 56,
    height: 56,
    marginTop: -18,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
