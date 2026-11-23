import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { TextInput } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, radius, space, statusInfo, type } from './theme';

export const Icon = MaterialCommunityIcons;

/** Scales down slightly while pressed: quiet feedback that the tap landed. */
export const PressableScale = ({
  children,
  style,
  onPress,
  disabled,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  to = 0.98,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (value) =>
    Animated.spring(scale, {
      toValue: value,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => animate(to)}
      onPressOut={() => animate(1)}
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const BUTTON = {
  primary: {
    bg: colors.brand,
    pressed: colors.brandPressed,
    fg: '#ffffff',
    border: colors.brand,
  },
  secondary: {
    bg: colors.surface,
    pressed: colors.surfaceAlt,
    fg: colors.ink,
    border: colors.lineStrong,
  },
  ghost: {
    bg: 'transparent',
    pressed: colors.surfaceAlt,
    fg: colors.brand,
    border: 'transparent',
  },
  danger: {
    bg: 'transparent',
    pressed: colors.dangerSoft,
    fg: colors.danger,
    border: 'transparent',
  },
};

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  testID,
  style,
  compact,
}) => {
  const look = BUTTON[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{
        disabled: Boolean(inactive),
        busy: Boolean(loading),
      }}
      android_ripple={{
        color:
          variant === 'primary'
            ? 'rgba(255,255,255,0.18)'
            : 'rgba(15,23,42,0.06)',
      }}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        {
          backgroundColor: pressed ? look.pressed : look.bg,
          borderColor: look.border,
        },
        variant === 'primary' && inactive && !loading && styles.buttonDisabled,
        variant !== 'primary' && inactive && !loading && styles.buttonFaded,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={look.fg} size="small" />
      ) : (
        <View style={styles.buttonInner}>
          {icon ? <Icon name={icon} size={19} color={look.fg} /> : null}
          <Text style={[styles.buttonText, { color: look.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
};

/** Outlined text field in the app's style; password fields get a show/hide toggle. */
export const Field = ({ secure, style, right, ...props }) => {
  const [hidden, setHidden] = useState(true);
  return (
    <TextInput
      mode="outlined"
      outlineStyle={styles.fieldOutline}
      outlineColor={colors.lineStrong}
      activeOutlineColor={colors.brand}
      textColor={colors.ink}
      style={[styles.field, style]}
      {...props}
      secureTextEntry={secure ? hidden : false}
      right={
        secure ? (
          <TextInput.Icon
            icon={hidden ? 'eye-outline' : 'eye-off-outline'}
            color={colors.muted}
            onPress={() => setHidden(!hidden)}
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          />
        ) : (
          right
        )
      }
    />
  );
};

const BANNER = {
  error: {
    bg: colors.dangerSoft,
    border: colors.dangerLine,
    fg: colors.danger,
    icon: 'alert-circle-outline',
  },
  info: {
    bg: colors.infoSoft,
    border: colors.infoLine,
    fg: colors.info,
    icon: 'information-outline',
  },
  success: {
    bg: colors.successSoft,
    border: colors.successLine,
    fg: colors.success,
    icon: 'check-circle-outline',
  },
  warning: {
    bg: colors.warningSoft,
    border: colors.warningLine,
    fg: colors.warning,
    icon: 'alert-outline',
  },
};

/** An inline message: what happened and, where useful, what to do next. */
export const Banner = ({ tone = 'info', children, style, testID }) => {
  const look = BANNER[tone];
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: look.bg, borderColor: look.border },
        style,
      ]}
      testID={testID}
    >
      <Icon
        name={look.icon}
        size={18}
        color={look.fg}
        style={styles.bannerIcon}
      />
      <Text style={[type.label, styles.bannerText, { color: look.fg }]}>
        {children}
      </Text>
    </View>
  );
};

export const StatusBadge = ({ status, style }) => {
  const info = statusInfo(status);
  return (
    <View style={[styles.badge, { backgroundColor: info.soft }, style]}>
      <View style={[styles.badgeDot, { backgroundColor: info.color }]} />
      <Text style={[styles.badgeText, { color: info.text }]}>{info.label}</Text>
    </View>
  );
};

export const Tag = ({ icon, children, tone = 'neutral', style }) => (
  <View style={[styles.tag, tone === 'brand' && styles.tagBrand, style]}>
    {icon ? (
      <Icon
        name={icon}
        size={14}
        color={tone === 'brand' ? colors.brandPressed : colors.muted}
      />
    ) : null}
    <Text
      style={[
        styles.tagText,
        tone === 'brand' && { color: colors.brandPressed },
      ]}
    >
      {children}
    </Text>
  </View>
);

const STEPS = ['Reported', 'In progress', 'Resolved'];
const stepIndex = (status) =>
  status === 'Resolved' ? 2 : status === 'In Progress' ? 1 : 0;

/**
 * Where a report is: Reported -> In progress -> Resolved. Compact on cards,
 * with labels (and the date each step was reached) on the issue screen.
 */
export const ProgressTrack = ({ status, dates = [], compact }) => {
  const current = stepIndex(status);
  const color = statusInfo(status).color;
  if (compact) {
    return (
      <View
        style={styles.trackCompact}
        accessibilityLabel={`Progress: ${STEPS[current]}`}
      >
        {STEPS.map((step, index) => (
          <View
            key={step}
            style={[
              styles.trackSegment,
              { backgroundColor: index <= current ? color : colors.line },
            ]}
          />
        ))}
      </View>
    );
  }
  return (
    <View style={styles.track}>
      {STEPS.map((step, index) => {
        const done = index <= current;
        return (
          <View key={step} style={styles.trackStep}>
            <View style={styles.trackRail}>
              <View
                style={[
                  styles.trackLine,
                  index === 0 && styles.trackLineHidden,
                  { backgroundColor: done ? color : colors.line },
                ]}
              />
              <View
                style={[
                  styles.trackNode,
                  done ? { backgroundColor: color, borderColor: color } : null,
                ]}
              >
                {done ? <Icon name="check" size={12} color="#ffffff" /> : null}
              </View>
              <View
                style={[
                  styles.trackLine,
                  index === STEPS.length - 1 && styles.trackLineHidden,
                  { backgroundColor: index < current ? color : colors.line },
                ]}
              />
            </View>
            <Text style={[styles.trackLabel, done && styles.trackLabelDone]}>
              {step}
            </Text>
            <Text style={styles.trackDate}>
              {done && dates[index] ? dates[index] : ' '}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

export const EmptyState = ({ icon, title, body, action, style }) => (
  <View style={[styles.empty, style]}>
    <View style={styles.emptyIcon}>
      <Icon name={icon} size={28} color={colors.brand} />
    </View>
    <Text style={[type.heading, styles.center]}>{title}</Text>
    {body ? (
      <Text style={[type.body, styles.center, { color: colors.muted }]}>
        {body}
      </Text>
    ) : null}
    {action ? <View style={styles.emptyAction}>{action}</View> : null}
  </View>
);

/** A grey block that pulses gently while content loads. */
export const Skeleton = ({ style }) => {
  const opacity = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[styles.skeleton, style, { opacity }]} />;
};

export const Card = ({ children, style }) => (
  <View style={[styles.card, style]}>{children}</View>
);

export const SectionTitle = ({ children, style, right }) => (
  <View style={[styles.sectionRow, style]}>
    <Text style={styles.sectionTitle}>{children}</Text>
    {right}
  </View>
);

/** A row in a settings-style list. */
export const ListRow = ({
  icon,
  title,
  subtitle,
  onPress,
  tone,
  testID,
  right,
  last,
}) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    testID={testID}
    accessibilityRole={onPress ? 'button' : undefined}
    android_ripple={onPress ? { color: 'rgba(15,23,42,0.06)' } : undefined}
    style={[styles.row, !last && styles.rowDivider]}
  >
    <View
      style={[
        styles.rowIcon,
        tone === 'danger' && { backgroundColor: colors.dangerSoft },
      ]}
    >
      <Icon
        name={icon}
        size={20}
        color={tone === 'danger' ? colors.danger : colors.ink2}
      />
    </View>
    <View style={styles.rowText}>
      <Text
        style={[type.bodyStrong, tone === 'danger' && { color: colors.danger }]}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={type.caption} numberOfLines={1}>
          {subtitle}
        </Text>
      ) : null}
    </View>
    {right !== undefined ? (
      right
    ) : (
      <Icon name="chevron-right" size={22} color={colors.faint} />
    )}
  </Pressable>
);

export const Avatar = ({ name, size = 44 }) => {
  const initials = (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>
        {initials || '?'}
      </Text>
    </View>
  );
};

export const Logo = ({ size = 48 }) => (
  <Image
    source={require('../../assets/icon.png')}
    style={{ width: size, height: size, borderRadius: size * 0.24 }}
    accessibilityIgnoresInvertColors
  />
);

/**
 * Covers the status bar area on screens that scroll, so content passes
 * under a solid band instead of behind the clock and battery icons.
 */
export const StatusBarBackdrop = () => {
  const insets = useSafeAreaInsets();
  return (
    <View
      pointerEvents="none"
      style={[styles.statusBackdrop, { height: insets.top }]}
    />
  );
};

/** Top of a tab screen: title, optional subtitle and an accessory on the right. */
export const ScreenHeader = ({ title, subtitle, right, style }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + space.lg }, style]}>
      <View style={styles.headerText}>
        <Text style={type.display}>{title}</Text>
        {subtitle ? (
          <Text style={[type.body, { color: colors.muted, marginTop: 2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
};

/** A round icon button, e.g. back or refresh. */
export const IconButton = ({
  icon,
  onPress,
  accessibilityLabel,
  testID,
  tone = 'plain',
  style,
}) => (
  <Pressable
    onPress={onPress}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="button"
    testID={testID}
    hitSlop={8}
    android_ripple={{
      color: 'rgba(15,23,42,0.08)',
      borderless: true,
      radius: 22,
    }}
    style={[
      styles.iconButton,
      tone === 'overlay' && styles.iconButtonOverlay,
      tone === 'outlined' && styles.iconButtonOutlined,
      style,
    ]}
  >
    <Icon
      name={icon}
      size={22}
      color={tone === 'overlay' ? colors.ink : colors.ink2}
    />
  </Pressable>
);

const styles = StyleSheet.create({
  center: { textAlign: 'center' },

  button: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  buttonCompact: { minHeight: 40, paddingHorizontal: space.md },
  buttonDisabled: { backgroundColor: '#9db8f5', borderColor: '#9db8f5' },
  buttonFaded: { opacity: 0.45 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  buttonText: { fontSize: 15, fontWeight: '600', letterSpacing: 0.1 },

  field: { backgroundColor: colors.surface, fontSize: 15 },
  fieldOutline: { borderRadius: radius.md },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 10,
  },
  bannerIcon: { marginTop: 1 },
  bannerText: { flex: 1 },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },

  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
  },
  tagBrand: { backgroundColor: colors.brandSoft },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.ink2 },

  trackCompact: { flexDirection: 'row', gap: 4 },
  trackSegment: { flex: 1, height: 4, borderRadius: 2 },
  track: { flexDirection: 'row' },
  trackStep: { flex: 1, alignItems: 'center' },
  trackRail: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  trackLine: { flex: 1, height: 2 },
  trackLineHidden: { opacity: 0 },
  trackNode: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackLabel: { ...type.micro, marginTop: 8, color: colors.faint },
  trackLabelDone: { color: colors.ink, fontWeight: '600' },
  trackDate: { ...type.micro, fontWeight: '400', marginTop: 2 },

  empty: {
    alignItems: 'center',
    paddingHorizontal: space.xxl,
    paddingVertical: 56,
    gap: space.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyAction: { marginTop: space.md, alignSelf: 'stretch' },

  skeleton: { backgroundColor: '#e6e9ef', borderRadius: radius.sm },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    color: colors.muted,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 1 },

  avatar: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: '#ffffff', fontWeight: '700' },

  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingBottom: space.md,
    gap: space.md,
  },
  headerText: { flex: 1 },
  statusBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
  },

  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonOverlay: {
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 2,
  },
  iconButtonOutlined: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
});
