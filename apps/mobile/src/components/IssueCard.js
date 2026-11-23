import React from "react";
import { photoUrl } from "../utils/api";
import { useCategories, categoryLabel, CATEGORY_ICONS } from "../utils/categories";
import { StyleSheet, View } from "react-native";
import { Card, Text, Chip } from "react-native-paper";

const STATUS_COLORS = {
  Open: "#f97316",
  "In Progress": "#eab308",
  Resolved: "#22c55e",
};

const IssueCard = ({ issue, onPress }) => {
  const categories = useCategories();
  const statusColor = STATUS_COLORS[issue.status] || "#64748b";
  // A resolved issue shows the city team's photo of the fix.
  const showsFix = issue.status === "Resolved" && Boolean(issue.resolved_photo_url);
  const thumbnail =
    photoUrl(showsFix ? issue.resolved_photo_url : issue.photo_url) ||
    "https://images.unsplash.com/photo-1529429617124-aee711fa4eec?auto=format&fit=crop&w=800&q=60";

  return (
    <Card style={styles.card} onPress={onPress} testID={`issue-card-${issue.id}`}>
      <Card.Cover
        source={{ uri: thumbnail }}
        style={styles.image}
        resizeMode="contain"
        accessibilityLabel={showsFix ? "Photo of the fix from the city team" : "Photo of the reported problem"}
      />
      <Card.Content style={styles.content}>
        <Text variant="titleMedium" style={styles.title}>
          {issue.title}
        </Text>
        <Text variant="bodyMedium" style={styles.description} numberOfLines={2}>
          {issue.description}
        </Text>
        <View style={styles.chipRow}>
          <Chip
            style={[styles.statusChip, { backgroundColor: `${statusColor}22` }]}
            textStyle={{ color: statusColor }}
          >
            {issue.status}
          </Chip>
          <Chip icon={CATEGORY_ICONS[issue.category] || CATEGORY_ICONS.other} style={styles.categoryChip} compact>
            {categoryLabel(categories, issue.category)}
          </Chip>
          {issue.is_mine && (
            <Chip style={styles.mineChip} textStyle={styles.mineText} compact>
              Your report
            </Chip>
          )}
        </View>
        {showsFix ? (
          <Text variant="bodySmall" style={styles.fixNote}>
            Photo from the city team after the fix
          </Text>
        ) : null}
        {issue.address ? (
          <Text variant="bodySmall" style={styles.meta}>
            📍 {issue.address}
          </Text>
        ) : (
          <Text variant="bodySmall" style={styles.meta}>
            📍 {Number(issue.latitude).toFixed(4)},{" "}
            {Number(issue.longitude).toFixed(4)}
          </Text>
        )}
        <Text variant="bodySmall" style={styles.meta}>
          Reported{" "}
          {new Date(issue.created_at || issue.createdAt).toLocaleString()}
        </Text>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  fixNote: {
    color: "#15803d",
    marginTop: 8,
  },
  card: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: "hidden",
  },
  image: {
    height: 160,
  },
  content: {
    gap: 8,
    paddingVertical: 12,
  },
  title: {
    fontWeight: "600",
  },
  description: {
    color: "#475569",
  },
  statusChip: {
    alignSelf: "flex-start",
  },
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
  meta: {
    color: "#94a3b8",
  },
});

export default IssueCard;
