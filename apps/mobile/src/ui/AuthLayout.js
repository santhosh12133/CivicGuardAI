import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { IconButton, Logo } from "./components";
import { colors, space, type } from "./theme";

/**
 * Frame for the sign-in screens: logo or back button, a title, one line of
 * context, the form, and a footer pinned to the bottom when there is room.
 */
const AuthLayout = ({ title, subtitle, children, footer, back = false }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + (back ? space.sm : 48), paddingBottom: insets.bottom + space.xxl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {back ? (
          <IconButton
            icon="arrow-left"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
            testID="auth-back"
            style={styles.back}
          />
        ) : (
          <Logo size={52} />
        )}
        <Text style={[type.display, styles.title]}>{title}</Text>
        {subtitle ? <Text style={[type.body, styles.subtitle]}>{subtitle}</Text> : null}
        <View style={styles.form}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { flexGrow: 1, paddingHorizontal: space.xxl },
  back: { marginLeft: -8, marginBottom: space.lg },
  title: { marginTop: space.xxl },
  subtitle: { color: colors.muted, marginTop: space.sm },
  form: { marginTop: space.xxl + space.xs, gap: space.md + 2 },
  footer: { flexGrow: 1, justifyContent: "flex-end", paddingTop: space.xxxl },
});

export default AuthLayout;
