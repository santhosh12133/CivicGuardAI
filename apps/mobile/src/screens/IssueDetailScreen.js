import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Text, Button, Chip, Card } from "react-native-paper";
import { useRoute, useFocusEffect } from "@react-navigation/native";
import api from "../utils/api";
import RemotePhoto from "../components/RemotePhoto";
import { useCategories, categoryLabel, CATEGORY_ICONS } from "../utils/categories";

const STATUS_COLORS = {
  Open: "#f97316",
  "In Progress": "#eab308",
  Resolved: "#22c55e",
};

const describeUpdate = (update) => {
  if (!update.from_status && update.to_status === "Open") return "Reported";
  if (update.to_status === "Resolved") return "Marked as resolved";
  if (update.to_status) return `Status changed to ${update.to_status}`;
  if (update.photo_url && !update.note) return "Photo added";
  return "Update from the team";
};

const describeAuthor = (author) => {
  if (!author) return "CivicFix";
  if (author.is_me) return "You";
  if (author.role === "citizen") return "Citizen";
  return author.name ? `${author.name} (city team)` : "City team";
};

const IssueDetailScreen = ({ navigation }) => {
  const categories = useCategories();
  const route = useRoute();
  const { issueId } = route.params || {};
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [refreshing, setRefreshing] = useState(false);
  const loaded = useRef(false);

  // Loads the issue; later loads keep the current screen until the new data arrives.
  const fetchIssueDetails = useCallback(async () => {
    try {
      if (!loaded.current) setLoading(true);
      const { data } = await api.get(`/api/issues/${issueId}`);
      setIssue(data.issue || data);
      setError(null);
      loaded.current = true;
    } catch (err) {
      if (!loaded.current) setError(err.message || "Failed to load issue details");
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator animating color="#2563eb" size="large" />
        <Text style={styles.loaderText}>Loading issue details...</Text>
      </View>
    );
  }

  if (error || !issue) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error || "Issue not found"}</Text>
        <Button mode="contained" onPress={() => navigation.goBack()}>
          Go Back
        </Button>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[issue.status] || "#64748b";

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <Button
          mode="text"
          onPress={() => navigation.goBack()}
          icon="arrow-left"
          style={styles.backButton}
        >
          Back
        </Button>
        <Text variant="headlineMedium" style={styles.title}>
          {issue.title}
        </Text>
      </View>

      {/* Status and category */}
      <View style={[styles.statusContainer, styles.chipRow]}>
        <Chip
          style={{ backgroundColor: `${statusColor}22` }}
          textStyle={{ color: statusColor, fontWeight: "600" }}
        >
          {issue.status}
        </Chip>
        <Chip icon={CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.other} style={styles.categoryChip}>
          {categoryLabel(categories, issue.category)}
        </Chip>
        {issue.is_mine && (
          <Chip style={styles.mineChip} textStyle={styles.mineText}>
            Your report
          </Chip>
        )}
      </View>

      {/* Issue Photo */}
      {issue && issue.photo_url ? (
        <Card style={styles.photoCard}>
          <Card.Content style={styles.photoContent}>
            <Text variant="titleSmall" style={styles.photoLabel}>
              Issue Photo
            </Text>
            <RemotePhoto
              url={issue.photo_url}
              style={styles.issueImage}
              resizeMode="contain"
              testID="issue-photo"
              accessibilityLabel="Photo of the reported problem"
            />
          </Card.Content>
        </Card>
      ) : (
        <Card style={styles.photoCard}>
          <Card.Content style={styles.photoContent}>
            <Text variant="titleSmall" style={styles.photoLabel}>
              Issue Photo
            </Text>
            <View
              style={[
                styles.issueImage,
                {
                  backgroundColor: "#e0e0e0",
                  justifyContent: "center",
                  alignItems: "center",
                },
              ]}
            >
              <Text style={{ color: "#999" }}>No photo available</Text>
            </View>
          </Card.Content>
        </Card>
      )}

      {/* The city team's photo of the finished work */}
      {issue.status === "Resolved" && issue.resolved_photo_url ? (
        <Card style={styles.resolvedCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.resolvedTitle}>
              Resolution photo
            </Text>
            <Text variant="bodySmall" style={styles.resolvedSubtext}>
              Taken by the city team when the work was done.
            </Text>
            <RemotePhoto
              url={issue.resolved_photo_url}
              style={styles.resolvedImage}
              resizeMode="contain"
              testID="resolution-photo"
              accessibilityLabel="Resolution photo from the city team"
            />
          </Card.Content>
        </Card>
      ) : null}

      {/* Description */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Description
          </Text>
          <Text variant="bodyMedium" style={styles.descriptionText}>
            {issue.description}
          </Text>
        </Card.Content>
      </Card>

      {/* Location Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Location
          </Text>
          {issue.address && (
            <Text variant="bodyMedium" style={styles.addressText}>
              📍 {issue.address}
            </Text>
          )}
          <Text variant="bodySmall" style={styles.coordinatesText}>
            {Number(issue.latitude).toFixed(4)},{" "}
            {Number(issue.longitude).toFixed(4)}
          </Text>
        </Card.Content>
      </Card>

      {/* Date Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleSmall" style={styles.sectionTitle}>
            Reported
          </Text>
          <Text variant="bodyMedium" style={styles.dateText}>
            {new Date(issue.created_at || issue.createdAt).toLocaleString()}
          </Text>
        </Card.Content>
      </Card>

      {/* Timeline of updates from the city team */}
      {Array.isArray(issue.updates) && issue.updates.length > 0 && (
        <Card style={styles.card}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.sectionTitle}>
              Updates
            </Text>
            {issue.updates.map((update, index) => (
              <View
                key={update.id}
                style={[styles.timelineItem, index === issue.updates.length - 1 && styles.timelineItemLast]}
              >
                <View
                  style={[
                    styles.timelineDot,
                    { backgroundColor: STATUS_COLORS[update.to_status] || "#94a3b8" },
                  ]}
                />
                <View style={styles.timelineBody}>
                  <Text variant="bodyMedium" style={styles.timelineTitle}>
                    {describeUpdate(update)}
                  </Text>
                  {update.note ? (
                    <Text variant="bodyMedium" style={styles.timelineNote}>
                      {update.note}
                    </Text>
                  ) : null}
                  {update.photo_url ? (
                    <RemotePhoto
                      url={update.photo_url}
                      style={styles.timelinePhoto}
                      accessibilityLabel="Photo added to this update"
                    />
                  ) : null}
                  <Text variant="bodySmall" style={styles.timelineMeta}>
                    {new Date(update.created_at).toLocaleString()} · {describeAuthor(update.author)}
                  </Text>
                </View>
              </View>
            ))}
          </Card.Content>
        </Card>
      )}

      {/* Additional Info */}
      {issue.needs_review && (
        <Card style={styles.warningCard}>
          <Card.Content>
            <Text variant="titleSmall" style={styles.warningTitle}>
              ⚠️ Under Review
            </Text>
            <Text variant="bodySmall" style={styles.warningText}>
              This issue is pending manual review by our team.
            </Text>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  categoryChip: {
    backgroundColor: "#f1f5f9",
  },
  mineChip: {
    backgroundColor: "#dbeafe",
  },
  mineText: {
    color: "#1d4ed8",
  },
  timelineItem: {
    flexDirection: "row",
    paddingBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: "#e2e8f0",
    marginLeft: 6,
    paddingLeft: 16,
  },
  timelineItemLast: {
    borderLeftColor: "transparent",
    paddingBottom: 0,
  },
  timelineDot: {
    position: "absolute",
    left: -7,
    top: 4,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  timelineBody: {
    flex: 1,
    gap: 4,
  },
  timelineTitle: {
    fontWeight: "600",
  },
  timelineNote: {
    color: "#334155",
  },
  timelinePhoto: {
    width: "100%",
    height: 160,
    borderRadius: 8,
    marginTop: 4,
  },
  timelineMeta: {
    color: "#94a3b8",
  },
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 64,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 8,
  },
  title: {
    fontWeight: "700",
    color: "#1e293b",
  },
  statusContainer: {
    marginBottom: 16,
  },
  card: {
    marginBottom: 12,
    borderRadius: 12,
  },
  photoCard: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  photoContent: {
    padding: 0,
  },
  photoLabel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    marginBottom: 8,
    fontWeight: "600",
    color: "#475569",
  },
  issueImage: {
    width: "100%",
    height: 300,
    borderRadius: 8,
  },
  sectionTitle: {
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  descriptionText: {
    color: "#1e293b",
    lineHeight: 24,
  },
  addressText: {
    color: "#2563eb",
    fontWeight: "500",
    marginBottom: 4,
  },
  coordinatesText: {
    color: "#64748b",
    fontStyle: "italic",
  },
  dateText: {
    color: "#1e293b",
  },
  resolvedCard: {
    marginTop: 0,
    marginBottom: 12,
    backgroundColor: "#dcfce7",
    borderRadius: 12,
  },
  resolvedTitle: {
    fontWeight: "600",
    color: "#15803d",
    marginBottom: 4,
  },
  resolvedSubtext: {
    color: "#166534",
    marginBottom: 12,
  },
  resolvedImage: {
    width: "100%",
    height: 250,
    borderRadius: 8,
    backgroundColor: "#e2e8f0",
  },
  warningCard: {
    marginBottom: 12,
    backgroundColor: "#fef3c7",
    borderRadius: 12,
  },
  warningTitle: {
    fontWeight: "600",
    color: "#b45309",
    marginBottom: 4,
  },
  warningText: {
    color: "#92400e",
  },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loaderText: {
    marginTop: 12,
    color: "#64748b",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    paddingHorizontal: 16,
  },
  errorText: {
    color: "#dc2626",
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
});

export default IssueDetailScreen;
