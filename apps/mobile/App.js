import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider as PaperProvider } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";
import { paperTheme } from "./src/ui/theme";

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={paperTheme} settings={{ icon: (props) => <MaterialCommunityIcons {...props} /> }}>
        <AuthProvider>
          <StatusBar style="dark" />
          <AppNavigator />
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}
