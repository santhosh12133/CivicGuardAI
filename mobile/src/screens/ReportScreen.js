import React, { useState } from "react";
import { View, StyleSheet, Image, ScrollView } from "react-native";
import { Button, TextInput, Text, Snackbar, HelperText } from "react-native-paper";
import MapView, { Marker } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

const ReportScreen = ({ navigation }) => {
  const { token } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState("");
  const [permissionError, setPermissionError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") throw new Error("Location permission is required to submit an issue");
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return { latitude: location.coords.latitude, longitude: location.coords.longitude };
  };

  const checkPermissions = async (type) => {
    try {
      const result = type === "gallery"
        ? await ImagePicker.requestMediaLibraryPermissionsAsync()
        : await ImagePicker.requestCameraPermissionsAsync();
      if (result.status !== "granted") {
        setPermissionError(type === "gallery" ? "Please enable gallery access in device settings." : "Please enable camera access in device settings.");
        return false;
      }
      return true;
    } catch (err) {
      setError(`Permission error: ${err.message}`);
      return false;
    }
  };

  const handlePickImage = async (type) => {
    try {
      setError(null);
      setPermissionError("");
      if (!(await checkPermissions(type))) return;

      const options = {
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 1,
        exif: true,
        base64: false,
        selectionLimit: 1,
      };
      const result = type === "gallery"
        ? await ImagePicker.launchImageLibraryAsync(options)
        : await ImagePicker.launchCameraAsync(options);

      if (!result.canceled && result.assets?.length) setPhoto(result.assets[0]);
    } catch (err) {
      setError(`Failed to capture image: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!cleanTitle || !cleanDescription) {
      setError("Please provide a title and description");
      return;
    }
    if (!photo?.uri) {
      setError("Please capture or select a photo before submitting the issue.");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setUploadStatus("Getting location...");
      const locationCoords = coords || (await requestLocation());
      setCoords(locationCoords);

      const formData = new FormData();
      formData.append("title", cleanTitle);
      formData.append("description", cleanDescription);
      formData.append("latitude", String(locationCoords.latitude));
      formData.append("longitude", String(locationCoords.longitude));

      const filename = photo.fileName || photo.uri.split("/").pop() || "issue.jpg";
      const extension = filename.split(".").pop()?.toLowerCase();
      const mimeType = photo.mimeType || ({ jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" }[extension] || "image/jpeg");
      formData.append("image", { uri: photo.uri, name: filename, type: mimeType });

      setUploadStatus("Uploading and validating photo...");
      const response = await api.post("/api/issues", formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const issueData = response.data;

      setSuccessMessage("Issue reported successfully!");
      setUploadStatus("");
      setTitle("");
      setDescription("");
      setPhoto(null);
      setAddress(issueData?.address || null);

      const newId = issueData?.id || issueData?.data?.id;
      if (newId) setTimeout(() => navigation.navigate("IssueDetail", { issueId: newId }), 500);
    } catch (err) {
      setError(err.message || "Failed to submit issue");
      setUploadStatus("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>Report a Civic Issue</Text>
      <Text variant="bodyMedium" style={styles.subtitle}>Capture the scene, add details, and we’ll route it to the right team.</Text>
      <View style={styles.photoSection}>
        {photo ? <Image source={{ uri: photo.uri }} style={styles.previewImage} resizeMode="contain" /> : <View style={styles.placeholderContainer}><Text style={styles.placeholderIcon}>📸</Text><Text style={styles.placeholderText}>Take a clear photo of the issue</Text><Text style={styles.placeholderSubText}>A photo is required for verification.</Text></View>}
        <View style={styles.buttonGroup}>
          <Button mode="outlined" onPress={() => handlePickImage("camera")} style={styles.photoButton} icon="camera">{photo ? "Retake Photo" : "Capture Photo"}</Button>
          <Button mode="outlined" onPress={() => handlePickImage("gallery")} style={styles.photoButton} icon="image">Gallery</Button>
        </View>
        {permissionError && <Text style={styles.permissionError}>{permissionError}</Text>}
      </View>
      <TextInput label="Title" value={title} onChangeText={setTitle} mode="outlined" style={styles.input} maxLength={120} />
      <TextInput label="Description" value={description} onChangeText={setDescription} multiline numberOfLines={4} mode="outlined" style={[styles.input, styles.description]} maxLength={2000} />
      {coords && <View style={styles.locationSection}><Text style={styles.locationLabel}>Location:</Text><Text style={styles.locationText}>📍 {coords.latitude.toFixed(4)}, {coords.longitude.toFixed(4)}</Text>{address && <Text style={styles.addressText}>📍 {address}</Text>}</View>}
      {error && <HelperText type="error">{error}</HelperText>}
      {uploadStatus && <View style={styles.uploadStatusBox}><Text style={styles.uploadStatusText}>⏳ {uploadStatus}</Text></View>}
      {coords && <MapView style={styles.map} region={{ latitude: coords.latitude, longitude: coords.longitude, latitudeDelta: 0.0922, longitudeDelta: 0.0421 }} onPress={(e) => setCoords(e.nativeEvent.coordinate)}><Marker draggable coordinate={coords} onDragEnd={(e) => setCoords(e.nativeEvent.coordinate)} /></MapView>}
      <Button mode="contained" onPress={handleSubmit} loading={loading} disabled={loading} style={styles.submitButton}>{loading ? "Submitting..." : "Submit Issue"}</Button>
      <Snackbar visible={!!successMessage} onDismiss={() => setSuccessMessage("")} duration={3000}>{successMessage}</Snackbar>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: "#f8fafc", paddingHorizontal: 16, paddingTop: 48, paddingBottom: 64 },
  title: { fontWeight: "700" },
  subtitle: { color: "#64748b", marginTop: 8, marginBottom: 24 },
  photoSection: { alignItems: "center", marginBottom: 24, gap: 12, width: "100%" },
  previewImage: { width: "100%", height: 320, borderRadius: 16, backgroundColor: "#e2e8f0" },
  placeholderContainer: { width: "100%", height: 200, backgroundColor: "#e2e8f0", borderRadius: 16, justifyContent: "center", alignItems: "center", padding: 16 },
  placeholderIcon: { fontSize: 40, marginBottom: 12 },
  placeholderText: { fontSize: 16, fontWeight: "600", color: "#475569", textAlign: "center", marginBottom: 8 },
  placeholderSubText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  photoButton: { flex: 1, marginHorizontal: 4 },
  buttonGroup: { flexDirection: "row", justifyContent: "space-around", width: "100%" },
  permissionError: { color: "#ef4444", fontSize: 14, marginTop: 8, textAlign: "center" },
  input: { marginBottom: 16 },
  description: { minHeight: 120 },
  submitButton: { marginTop: 8 },
  locationSection: { marginBottom: 16, padding: 12, backgroundColor: "#f1f5f9", borderRadius: 8 },
  locationLabel: { fontSize: 12, fontWeight: "600", color: "#64748b", marginBottom: 4 },
  locationText: { color: "#2563eb", marginBottom: 4, fontSize: 14 },
  addressText: { color: "#1e293b", fontSize: 14, marginTop: 4 },
  uploadStatusBox: { marginBottom: 16, padding: 12, backgroundColor: "#e3f2fd", borderRadius: 8 },
  uploadStatusText: { color: "#1565c0", fontStyle: "italic", fontSize: 14 },
  map: { height: 200, marginBottom: 16 },
});

export default ReportScreen;
