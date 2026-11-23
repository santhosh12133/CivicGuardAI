import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { photoUrl } from '../utils/api';
import { Icon } from '../ui/components';
import { colors } from '../ui/theme';

/**
 * A photo stored on the CivicFix server. It fades in once loaded, and if it
 * cannot be loaded it says so instead of leaving an empty box. Once loaded its
 * test ID gets a "-loaded" suffix, which the end-to-end tests wait for.
 */
const RemotePhoto = ({
  url,
  style,
  resizeMode = 'cover',
  testID,
  accessibilityLabel,
  compact,
  onFailed,
}) => {
  const [state, setState] = useState('loading');
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setState('loading');
    opacity.setValue(0);
  }, [url, opacity]);

  if (state === 'failed') {
    return (
      <View
        style={[styles.fallback, style]}
        testID={testID ? `${testID}-failed` : undefined}
      >
        <Icon
          name="image-off-outline"
          size={compact ? 22 : 28}
          color={colors.faint}
        />
        {!compact ? (
          <Text style={styles.fallbackText}>
            The photo could not be loaded. Pull down to try again.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <View style={[styles.frame, style]}>
      <Animated.Image
        source={{ uri: photoUrl(url) }}
        style={[StyleSheet.absoluteFill, { opacity }]}
        resizeMode={resizeMode}
        accessible
        accessibilityLabel={accessibilityLabel}
        testID={
          testID ? `${testID}${state === 'loaded' ? '-loaded' : ''}` : undefined
        }
        onLoad={() => {
          setState('loaded');
          Animated.timing(opacity, {
            toValue: 1,
            duration: 220,
            useNativeDriver: true,
          }).start();
        }}
        onError={() => {
          setState('failed');
          if (onFailed) onFailed();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  frame: { backgroundColor: '#e9edf2', overflow: 'hidden' },
  fallback: {
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  fallbackText: { color: colors.muted, fontSize: 13, textAlign: 'center' },
});

export default RemotePhoto;
