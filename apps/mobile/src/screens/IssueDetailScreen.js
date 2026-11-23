import React, { useCallback, useRef, useState } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import api from "../utils/api";
import RemotePhoto from "../components/RemotePhoto";
import { placeLine } from "../components/IssueCard";
import { useCategories, categoryLabel, CATEGORY_ICONS } from "../utils/categories";
import {
  Banner,
  Button,
  Card,
  EmptyState,
  Icon,
  IconButton,
  ProgressTrack,
  SectionTitle,
  Skeleton,
  StatusBadge,
  Tag,
} from "../ui/components";
import { colors, radius, space, statusInfo, STATUS, type } from "../ui/theme";
import { dateTime, shortDate } from "../ui/time";

const describeUpdate = (update) => {
  if (!update.from_status && update.to_status === "Open") return "Reported";
  if (update.to_status === "Resolved") return "Marked as resolved";
  if (update.to_status) return `Status changed to ${statusInfo(update.to_status).label}`;
  if (update.photo_url && !update.note) return "Photo added";
  return "Update from the city team";
};

const describeAuthor = (author) => {
  if (!author) return "CivicFix";
  if (author.is_me) return "You";
  if (author.role === "citizen") return "A resident";
  return author.name ? `${author.name}, city team` : "City team";
};

const openInMaps = ({ latitude, longitude }) =>
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);

// When each step of the progress track was reached, from the timeline.
const stepDates = (issue) => {
  const reachedAt = (status) => issue.updates?.find((update) => update.to_status === status)?.created_at;
  return [
    shortDate(issue.created_at || issue.createdAt),
    shortDate(reachedAt("In Progress")),
    shortDate(reachedAt("Resolved") || (issue.status === "Resolved" ? issue.updated_at : null)),
  ];
};

const TopBar = ({ onBack, title }) => {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: insets.top + space.xs }]}>
      <IconButton icon="arrow-left" onPress={onBack} accessibilityLabel="Back" testID="detail-back" />
      <Text style={[type.heading, styles.topTitle]} numberOfLines={1}>{title}</Text>
      <View style={styles.topSpacer} />
    </View>
  );
};

const LoadingDetail = () => (
  <View style={styles.content}>
    <Skeleton style={styles.photoSkeleton} />
    <Skeleton style={{ width: 110, height: 24, borderRadius: 12, marginTop: space.lg }} />
    <Skeleton style={{ width: "85%", height: 26, marginTop: space.md }} />
    <Skeleton style={{ width: "100%", height: 96, marginTop: space.lg, borderRadius: radius.lg }} />
  </View>
);

const IssueDetailScreen = ({ navigation }) => {
  const categories = useCategories();
  const route = useRoute();
  const { issueId } = route.params || {};
  const [issue, setIssue] = useState(null);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);

  // Loads the issue; later loads keep the current screen until the new data arrives.
  const fetchIssueDetails = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/issues/${issueId}`);
      setIssue(data.issue || data);
      setError(null);
      loaded.current = true;
    } catch (err) {
      if (!loaded.current) setError(err.message || "Could not load this report.");
    } finally {
      setRefreshing(false);
    }
  }, [issueId]);

  // Reload every time the screen is shown, so a status change or a resolution
  // photo from the city team appears without restarting the app.
  useFocusEffect(
    useCallback(() => {
      fetchIssueDetails();
    }, [fetchIssueDetails])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssueDetails();
  };

  const goBack = () => navigation.goBack();

  if (error && !issue) {
    return (
      <View style={styles.screen}>
        <TopBar onBack={goBack} title="Report" />
        <EmptyState
          icon="alert-circle-outline"
          title="Could not load this report"
          body={error}
          action={<Button variant="secondary" title="Try again" icon="refresh" onPress={() => { setError(null); fetchIssueDetails(); }} />}
        />
      </View>
    );
  }

  if (!issue) {
    return (
      <View style={styles.screen}>
        <TopBar onBack={goBack} title="Report" />
        <LoadingDetail />
      </View>
    );
  }

  const icon = CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.other;
  const resolvedPhoto = issue.status === "Resolved" && issue.resolved_photo_url;
  const updates = Array.isArray(issue.updates) ? issue.updates : [];

  return (
    <View style={styles.screen}>
      <TopBar onBack={goBack} title="Report" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} />}
        showsVerticalScrollIndicator={false}
      >
        {issue.photo_url ? (
          <RemotePhoto
            url={issue.photo_url}
            style={styles.photo}
            testID="issue-photo"
            accessibilityLabel="Photo of the reported problem"
          />
        ) : null}

        <View style={styles.tags}>
          <StatusBadge status={issue.status} />
          <Tag icon={icon}>{categoryLabel(categories, issue.category)}</Tag>
          {issue.is_mine ? <Tag tone="brand" icon="account-outline">Your report</Tag> : null}
        </View>
        <Text style={[type.title, styles.title]} testID="issue-detail">{issue.title}</Text>

        <Card style={styles.section}>
          <SectionTitle>Progress</SectionTitle>
          <ProgressTrack status={issue.status} dates={stepDates(issue)} />
        </Card>

        {resolvedPhoto ? (
          <Card style={[styles.section, styles.resolvedCard]}>
            <View style={styles.resolvedHead}>
              <Icon name="check-decagram" size={20} color={STATUS.Resolved.color} />
              <Text style={[type.heading, { color: STATUS.Resolved.text }]}>Resolution photo</Text>
            </View>
            <Text style={[type.caption, styles.resolvedCaption]}>Taken by the city team when the work was done.</Text>
            <RemotePhoto
              url={issue.resolved_photo_url}
              style={styles.resolvedPhoto}
              resizeMode="cover"
              testID="resolution-photo"
              accessibilityLabel="Resolution photo from the city team"
            />
          </Card>
        ) : null}

        {issue.needs_review && issue.status !== "Resolved" ? (
          <Banner tone="info" style={styles.section}>
            The city team is checking the photo and location before acting on this report.
          </Banner>
        ) : null}

        {issue.description ? (
          <Card style={styles.section}>
            <SectionTitle>Description</SectionTitle>
            <Text style={type.body}>{issue.description}</Text>
          </Card>
        ) : null}

        <Card style={styles.section}>
          <SectionTitle>Location</SectionTitle>
          <View style={styles.placeRow}>
            <View style={styles.placeIcon}>
              <Icon name="map-marker" size={20} color={colors.brand} />
            </View>
            <View style={styles.placeText}>
              <Text style={type.bodyStrong}>{placeLine(issue)}</Text>
              {issue.address ? (
                <Text style={type.caption}>
                  {Number(issue.latitude).toFixed(5)}, {Number(issue.longitude).toFixed(5)}
                </Text>
              ) : null}
            </View>
          </View>
          <Button
            variant="secondary"
            compact
            icon="map-outline"
            title="Open in Maps"
            onPress={() => openInMaps(issue)}
            style={styles.mapButton}
          />
        </Card>

        {updates.length ? (
          <Card style={styles.section}>
            <SectionTitle>Updates</SectionTitle>
            {updates.map((update, index) => {
              const last = index === updates.length - 1;
              return (
                <View key={update.id} style={styles.timelineItem}>
                  <View style={styles.timelineRail}>
                    <View
                      style={[
                        styles.timelineDot,
                        { backgroundColor: update.to_status ? statusInfo(update.to_status).color : colors.faint },
                      ]}
                    />
                    {!last ? <View style={styles.timelineLine} /> : null}
                  </View>
                  <View style={[styles.timelineBody, !last && styles.timelineBodySpaced]}>
                    <Text style={type.bodyStrong}>{describeUpdate(update)}</Text>
                    {update.note ? <Text style={type.body}>{update.note}</Text> : null}
                    {update.photo_url ? (
                      <RemotePhoto url={update.photo_url} style={styles.timelinePhoto} accessibilityLabel="Photo added to this update" />
                    ) : null}
                    <Text style={type.caption}>
                      {dateTime(update.created_at)}, {describeAuthor(update.author)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </Card>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.sm,
    paddingBottom: space.xs,
    backgroundColor: colors.background,
  },
  topTitle: { flex: 1, textAlign: "center" },
  topSpacer: { width: 40 },

  content: { padding: space.lg, paddingTop: space.sm, paddingBottom: space.xxxl },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg },
  photoSkeleton: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.lg },

  tags: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.lg },
  title: { marginTop: space.md },
  section: { marginTop: space.lg },

  resolvedCard: { borderColor: "#bbf7d0", backgroundColor: "#f7fdf9" },
  resolvedHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  resolvedCaption: { marginTop: 2, marginBottom: space.md },
  resolvedPhoto: { width: "100%", aspectRatio: 4 / 3, borderRadius: radius.md },

  placeRow: { flexDirection: "row", gap: space.md, alignItems: "center" },
  placeIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  placeText: { flex: 1, gap: 2 },
  mapButton: { marginTop: space.md },

  timelineItem: { flexDirection: "row", gap: space.md },
  timelineRail: { width: 12, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 6 },
  timelineLine: { flex: 1, width: 2, backgroundColor: colors.line, marginTop: 4 },
  timelineBody: { flex: 1, gap: 4 },
  timelineBodySpaced: { paddingBottom: space.lg },
  timelinePhoto: { width: "100%", aspectRatio: 16 / 9, borderRadius: radius.md, marginTop: 4 },
});

export default IssueDetailScreen;
