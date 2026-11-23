import React, { useState } from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Snackbar } from 'react-native-paper';
import MapView, { Marker } from 'react-native-maps';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useCategories, CATEGORY_ICONS } from '../utils/categories';
import {
  Banner,
  Button,
  Card,
  Field,
  Icon,
  ScreenHeader,
  StatusBarBackdrop,
} from '../ui/components';
import { colors, radius, space, type } from '../ui/theme';

// Google Maps on Android needs an API key baked into the build; rendering
// MapView without one crashes the app. Without a key, show a link instead.
const MAP_AVAILABLE =
  Platform.OS !== 'android' ||
  Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

const openInMaps = ({ latitude, longitude }) =>
  Linking.openURL(
    `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
  );

const TITLE_MAX = 120;
const DESCRIPTION_MAX = 2000;

/** Numbered heading: the form is filled in this order. */
const Step = ({ number, title, hint, children }) => (
  <View style={styles.step}>
    <View style={styles.stepHead}>
      <View style={styles.stepNumber}>
        <Text style={styles.stepNumberText}>{number}</Text>
      </View>
      <Text style={type.heading}>{title}</Text>
    </View>
    {hint ? <Text style={[type.caption, styles.stepHint]}>{hint}</Text> : null}
    {children}
  </View>
);

const ReportScreen = ({ navigation }) => {
  const { token } = useAuth();
  const categories = useCategories();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [coords, setCoords] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [permissionError, setPermissionError] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted')
      throw new Error(
        'Allow location access so the city team knows where the problem is.'
      );
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  };

  const checkPermissions = async (kind) => {
    try {
      const result =
        kind === 'gallery'
          ? await ImagePicker.requestMediaLibraryPermissionsAsync()
          : await ImagePicker.requestCameraPermissionsAsync();
      if (result.status !== 'granted') {
        setPermissionError(
          kind === 'gallery'
            ? "Photo access is off. Turn it on for CivicFix in your phone's settings."
            : "Camera access is off. Turn it on for CivicFix in your phone's settings."
        );
        return false;
      }
      return true;
    } catch (err) {
      setError(`Could not ask for permission: ${err.message}`);
      return false;
    }
  };

  const handlePickImage = async (kind) => {
    try {
      setError(null);
      setPermissionError('');
      if (!(await checkPermissions(kind))) return;
      const options = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 1,
        exif: true,
        base64: false,
        selectionLimit: 1,
      };
      const result =
        kind === 'gallery'
          ? await ImagePicker.launchImageLibraryAsync(options)
          : await ImagePicker.launchCameraAsync(options);
      if (!result.canceled && result.assets?.length) setPhoto(result.assets[0]);
    } catch (err) {
      setError(`Could not get the photo: ${err.message}`);
    }
  };

  const handleSubmit = async () => {
    const cleanTitle = title.trim();
    const cleanDescription = description.trim();
    if (!photo?.uri) return setError('Add a photo of the problem first.');
    if (!category)
      return setError('Please choose what kind of problem this is');
    if (!cleanTitle || !cleanDescription)
      return setError('Add a short title and a description.');

    try {
      setLoading(true);
      setError(null);
      setUploadStatus('Finding your location');
      const locationCoords = coords || (await requestLocation());
      setCoords(locationCoords);

      const formData = new FormData();
      formData.append('title', cleanTitle);
      formData.append('description', cleanDescription);
      formData.append('category', category);
      formData.append('latitude', String(locationCoords.latitude));
      formData.append('longitude', String(locationCoords.longitude));
      const filename =
        photo.fileName || photo.uri.split('/').pop() || 'issue.jpg';
      const extension = filename.split('.').pop()?.toLowerCase();
      const mimeType =
        photo.mimeType ||
        {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
          gif: 'image/gif',
        }[extension] ||
        'image/jpeg';
      formData.append('image', {
        uri: photo.uri,
        name: filename,
        type: mimeType,
      });

      setUploadStatus('Sending the photo and checking it');
      const response = await api.post('/api/issues', formData, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const issueData = response.data;

      setSuccessMessage('Report sent. You can follow it in My reports.');
      setUploadStatus('');
      setTitle('');
      setDescription('');
      setCategory(null);
      setPhoto(null);
      setCoords(null);

      const newId = issueData?.id || issueData?.data?.id;
      if (newId)
        setTimeout(
          () => navigation.navigate('IssueDetail', { issueId: newId }),
          500
        );
    } catch (err) {
      setError(err.message || 'The report could not be sent. Try again.');
      setUploadStatus('');
    } finally {
      setLoading(false);
    }
    return undefined;
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Report a problem"
          subtitle="Add a photo and a few details, and the city team takes it from there."
          style={styles.header}
        />

        <View style={styles.body}>
          <Step
            number="1"
            title="Photo"
            hint="A recent photo taken on your phone helps the city team check the report."
          >
            {photo ? (
              <Image
                source={{ uri: photo.uri }}
                style={styles.preview}
                resizeMode="cover"
                accessibilityLabel="Selected photo"
              />
            ) : (
              <Pressable
                onPress={() => handlePickImage('camera')}
                style={styles.dropzone}
                accessibilityRole="button"
              >
                <View style={styles.dropIcon}>
                  <Icon name="camera-outline" size={26} color={colors.brand} />
                </View>
                <Text style={type.bodyStrong}>Add a photo of the problem</Text>
                <Text style={type.caption}>
                  Take one now or choose one from your gallery
                </Text>
              </Pressable>
            )}
            <View style={styles.photoButtons}>
              <Button
                variant="secondary"
                compact
                icon="camera-outline"
                title={photo ? 'Retake' : 'Take photo'}
                onPress={() => handlePickImage('camera')}
                testID="report-camera"
                style={styles.photoButton}
              />
              <Button
                variant="secondary"
                compact
                icon="image-outline"
                title={photo ? 'Choose another' : 'Gallery'}
                onPress={() => handlePickImage('gallery')}
                testID="report-gallery"
                style={styles.photoButton}
              />
            </View>
            {permissionError ? (
              <Banner tone="warning">{permissionError}</Banner>
            ) : null}
          </Step>

          <Step number="2" title="What kind of problem is it?">
            <View style={styles.grid}>
              {categories.map((item) => {
                const selected = category === item.id;
                return (
                  <Pressable
                    key={item.id}
                    testID={`category-${item.id}`}
                    onPress={() => {
                      setCategory(item.id);
                      setError(null);
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    android_ripple={{ color: 'rgba(37,99,235,0.08)' }}
                    style={[styles.tile, selected && styles.tileSelected]}
                  >
                    <Icon
                      name={CATEGORY_ICONS[item.id] || CATEGORY_ICONS.other}
                      size={24}
                      color={selected ? colors.brand : colors.ink2}
                    />
                    <Text
                      style={[
                        styles.tileText,
                        selected && styles.tileTextSelected,
                      ]}
                      numberOfLines={2}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <View style={styles.tileCheck}>
                        <Icon name="check" size={12} color="#ffffff" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Step>

          <Step number="3" title="Details">
            <Field
              testID="report-title"
              label="Title"
              placeholder="For example: Deep pothole near the bus stop"
              value={title}
              onChangeText={setTitle}
              maxLength={TITLE_MAX}
            />
            <Field
              testID="report-description"
              label="Description"
              placeholder="What is wrong, and how is it affecting people?"
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={DESCRIPTION_MAX}
              style={styles.description}
            />
            <Text style={[type.micro, styles.counter]}>
              {description.length}/{DESCRIPTION_MAX}
            </Text>
          </Step>

          <Card style={styles.locationCard}>
            <View style={styles.locationRow}>
              <View style={styles.locationIcon}>
                <Icon name="crosshairs-gps" size={20} color={colors.brand} />
              </View>
              <View style={styles.locationText}>
                <Text style={type.bodyStrong}>Location</Text>
                <Text style={type.caption}>
                  {coords
                    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
                    : 'Your current location is added when you send the report.'}
                </Text>
              </View>
            </View>
            {coords && !MAP_AVAILABLE ? (
              <Button
                variant="ghost"
                compact
                icon="map-outline"
                title="Check in Maps"
                onPress={() => openInMaps(coords)}
                style={styles.mapLink}
              />
            ) : null}
            {coords && MAP_AVAILABLE ? (
              <MapView
                style={styles.map}
                region={{
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={(event) => setCoords(event.nativeEvent.coordinate)}
              >
                <Marker
                  draggable
                  coordinate={coords}
                  onDragEnd={(event) => setCoords(event.nativeEvent.coordinate)}
                />
              </MapView>
            ) : null}
          </Card>

          {error ? <Banner tone="error">{error}</Banner> : null}
          {uploadStatus ? (
            <Banner tone="info">{`${uploadStatus}…`}</Banner>
          ) : null}

          <Button
            testID="report-submit"
            title={loading ? 'Sending' : 'Send report'}
            icon="send-outline"
            onPress={handleSubmit}
            loading={loading}
          />
        </View>
      </ScrollView>
      <StatusBarBackdrop />
      <Snackbar
        visible={!!successMessage}
        onDismiss={() => setSuccessMessage('')}
        duration={3000}
      >
        {successMessage}
      </Snackbar>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingBottom: space.xxxl },
  header: { paddingBottom: space.sm },
  body: { paddingHorizontal: space.lg, gap: space.lg },

  step: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: space.lg,
    gap: space.md,
  },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2 },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  stepHint: { marginTop: -6 },

  dropzone: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.brandLine,
    backgroundColor: '#f8faff',
  },
  dropIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  preview: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  photoButtons: { flexDirection: 'row', gap: space.sm },
  photoButton: { flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    width: '31%',
    minHeight: 84,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: space.sm,
    overflow: 'hidden',
  },
  tileSelected: {
    borderColor: colors.brand,
    backgroundColor: colors.brandSoft,
    borderWidth: 1.5,
  },
  tileText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: colors.ink2,
    textAlign: 'center',
  },
  tileTextSelected: { color: colors.brandPressed, fontWeight: '600' },
  tileCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },

  description: { minHeight: 120 },
  counter: { alignSelf: 'flex-end', marginTop: -6, fontWeight: '400' },

  locationCard: { gap: space.md },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { flex: 1, gap: 2 },
  mapLink: { alignSelf: 'flex-start' },
  map: { height: 200, borderRadius: radius.md },
});

export default ReportScreen;
