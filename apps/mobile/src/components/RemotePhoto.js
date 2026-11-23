import React, { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Text } from "react-native-paper";
import { photoUrl } from "../utils/api";

/**
 * A photo stored on the CivicFix server. If it cannot be loaded, it says so
 * instead of leaving an empty box. Once the image has loaded its test ID gets
 * a "-loaded" suffix, which the end-to-end tests wait for.
 */
const RemotePhoto = ({ url, style, resizeMode = "cover", testID, accessibilityLabel }) => {
  const [state, setState] = useState("loading");
  useEffect(() => setState("loading"), [url]);

  if (state === "failed") {
    return (
      <View style={[style, styles.failed]} testID={testID ? `${testID}-failed` : undefined}>
        <Text variant="bodySmall" style={styles.failedText}>
          The photo could not be loaded. Pull down to try again.
        </Text>
      </View>
    );
  }
  return (
    <Image
      source={{ uri: photoUrl(url) }}
      style={[styles.image, style]}
      resizeMode={resizeMode}
      accessible
      accessibilityLabel={accessibilityLabel}
      testID={testID ? `${testID}${state === "loaded" ? "-loaded" : ""}` : undefined}
      onLoad={() => setState("loaded")}
      onError={() => setState("failed")}
    />
  );
};

const styles = StyleSheet.create({
  image: { backgroundColor: "#e2e8f0" },
  failed: {
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  failedText: { color: "#64748b", textAlign: "center" },
});

export default RemotePhoto;
