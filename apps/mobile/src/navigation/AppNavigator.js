import React from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import ServerScreen from "../screens/ServerScreen";
import PhoneLoginScreen from "../screens/PhoneLoginScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import HomeScreen, { MyReportsScreen } from "../screens/HomeScreen";
import ReportScreen from "../screens/ReportScreen";
import ProfileScreen from "../screens/ProfileScreen";
import IssueDetailScreen from "../screens/IssueDetailScreen";
import { useAuth } from "../context/AuthContext";
import { Logo } from "../ui/components";
import { colors, navigationTheme } from "../ui/theme";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Native transitions: screens slide in from the right, like the rest of Android.
const stackOptions = {
  headerShown: false,
  animation: "slide_from_right",
  contentStyle: { backgroundColor: colors.background },
};

const TAB_ICONS = {
  Home: ["home-outline", "home"],
  MyReports: ["document-text-outline", "document-text"],
  Report: ["add-circle-outline", "add-circle"],
  Profile: ["person-circle-outline", "person-circle"],
};

const tabOptions = ({ route }) => ({
  headerShown: false,
  animation: "fade",
  sceneStyle: { backgroundColor: colors.background },
  tabBarActiveTintColor: colors.brand,
  tabBarInactiveTintColor: colors.faint,
  tabBarLabelStyle: styles.tabLabel,
  tabBarStyle: styles.tabBar,
  tabBarItemStyle: styles.tabItem,
  tabBarIcon: ({ color, focused }) => (
    <Ionicons name={TAB_ICONS[route.name][focused ? 1 : 0]} color={color} size={24} />
  ),
});

const MainTabs = () => (
  <Tab.Navigator screenOptions={tabOptions}>
    <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Home" }} />
    <Tab.Screen name="Report" component={ReportScreen} options={{ title: "Report" }} />
    <Tab.Screen name="MyReports" component={MyReportsScreen} options={{ title: "My reports" }} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
  </Tab.Navigator>
);

const SignedInNavigator = () => (
  <Stack.Navigator screenOptions={stackOptions}>
    <Stack.Screen name="HomeTab" component={MainTabs} options={{ animation: "fade" }} />
    <Stack.Screen name="IssueDetail" component={IssueDetailScreen} />
  </Stack.Navigator>
);

// Without a server address (a build made before the server existed) the app
// starts on the server screen.
const AuthNavigator = ({ hasServer }) => (
  <Stack.Navigator screenOptions={stackOptions} initialRouteName={hasServer ? "Login" : "Server"}>
    <Stack.Screen name="Login" component={LoginScreen} options={{ animation: "fade" }} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="Server" component={ServerScreen} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const LoadingView = () => (
  <View style={styles.loading}>
    <Logo size={72} />
  </View>
);

const AppNavigator = () => {
  const { user, initializing, serverUrl } = useAuth();

  if (initializing) return <LoadingView />;

  return (
    <NavigationContainer theme={navigationTheme}>
      {user && serverUrl ? <SignedInNavigator /> : <AuthNavigator hasServer={Boolean(serverUrl)} />}
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  tabBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    height: undefined,
    paddingTop: 6,
  },
  tabItem: { paddingBottom: 4 },
  tabLabel: { fontSize: 12, fontWeight: "600", marginTop: 2 },
});

export default AppNavigator;
