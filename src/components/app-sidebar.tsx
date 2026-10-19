import { router, usePathname, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMyMembership } from '../data/household';
import { colors, radius, spacing, typography } from '../theme/tokens';
import { NavIcon, type NavIconName } from './nav-icon';
import { PrimaryButton } from './primary-button';

const ITEMS: { href: string; label: string; icon: NavIconName }[] = [
  { href: '/', label: 'Overview', icon: 'home' },
  { href: '/budget', label: 'Budget', icon: 'list' },
  { href: '/credit', label: 'Credit', icon: 'card' },
  { href: '/settings', label: 'Settings', icon: 'sliders' },
];

function isActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/' || pathname === '/index';
  }
  return pathname === href || pathname.startsWith(`${String(href)}/`);
}

export function AppSidebar() {
  const pathname = usePathname();
  const membership = useMyMembership();
  const roleLabel =
    membership.data?.role === 'partner' ? 'Partner account' : 'Primary account';

  return (
    <View style={styles.sidebar}>
      <Text style={styles.appName}>Household Budget</Text>
      <PrimaryButton
        title="New transaction"
        onPress={() => router.push('/transactions/new' as Href)}
      />
      <View style={styles.nav}>
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Pressable
              key={item.label}
              accessibilityRole="button"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: active }}
              onPress={() => router.push(item.href as Href)}
              style={[styles.item, active ? styles.itemActive : null]}>
              <NavIcon name={item.icon} color={active ? colors.okText : colors.muted} />
              <Text style={[styles.itemLabel, active ? styles.itemLabelActive : null]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.chip}>
        <Text style={styles.chipName}>{membership.data?.display_name ?? 'You'}</Text>
        <Text style={styles.chipRole}>{roleLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 240,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    padding: spacing[20],
    gap: spacing[16],
  },
  appName: {
    fontFamily: typography.family[800],
    fontSize: typography.size[17],
    color: colors.ink,
  },
  nav: {
    flex: 1,
    gap: spacing[8],
  },
  item: {
    minHeight: 44,
    borderRadius: radius.input,
    paddingHorizontal: spacing[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[12],
  },
  itemActive: {
    backgroundColor: colors.okBg,
  },
  itemLabel: {
    fontFamily: typography.family[600],
    fontSize: typography.size[14],
    color: colors.muted,
  },
  itemLabelActive: {
    color: colors.okText,
  },
  chip: {
    backgroundColor: colors.okBg,
    borderRadius: radius.input,
    paddingVertical: spacing[12],
    paddingHorizontal: spacing[12],
    gap: spacing[4],
  },
  chipName: {
    fontFamily: typography.family[700],
    fontSize: typography.size[14],
    color: colors.okText,
  },
  chipRole: {
    fontFamily: typography.family[500],
    fontSize: typography.size[12],
    color: colors.okText,
  },
});
