import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
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

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerShown: false,
  tabBarActiveTintColor: "#2563eb",
  tabBarInactiveTintColor: "#94a3b8",
  tabBarStyle: {
    height: 70,
    paddingBottom: 12,
    paddingTop: 12,
  },
};

const MainTabs = () => (
  <Tab.Navigator screenOptions={screenOptions}>
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="home" color={color} size={size} />
        ),
        title: "Home",
      }}
    />
    <Tab.Screen
      name="MyReports"
      component={MyReportsScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="document-text" color={color} size={size} />
        ),
        title: "My Reports",
      }}
    />
    <Tab.Screen
      name="Report"
      component={ReportScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="add-circle" color={color} size={size} />
        ),
        title: "Report",
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        tabBarIcon: ({ color, size }) => (
          <Ionicons name="person" color={color} size={size} />
        ),
        title: "Profile",
      }}
    />
  </Tab.Navigator>
);

const HomeStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
      cardStyle: { backgroundColor: "#f8fafc" },
    }}
  >
    <Stack.Screen name="HomeTab" component={MainTabs} />
    <Stack.Screen
      name="IssueDetail"
      component={IssueDetailScreen}
      options={{
        cardStyleInterpolator: ({ current: { progress } }) => ({
          cardStyle: {
            opacity: progress,
          },
        }),
      }}
    />
  </Stack.Navigator>
);

// Without a server address (a build made before the server existed) the app
// starts on the server screen.
const AuthNavigator = ({ hasServer }) => (
  <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={hasServer ? "Login" : "Server"}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Signup" component={SignupScreen} />
    <Stack.Screen name="Server" component={ServerScreen} />
    <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const LoadingView = () => (
  <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
    <ActivityIndicator size="large" color="#2563eb" />
  </View>
);

const AppNavigator = () => {
  const { user, initializing, serverUrl } = useAuth();

  if (initializing) {
    return <LoadingView />;
  }

  return (
    <NavigationContainer>
      {user && serverUrl ? <HomeStackNavigator /> : <AuthNavigator hasServer={Boolean(serverUrl)} />}
    </NavigationContainer>
  );
};

export default AppNavigator;
