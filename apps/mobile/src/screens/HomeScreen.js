import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import IssueCard from "../components/IssueCard";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import { useCategories, CATEGORY_ICONS } from "../utils/categories";
import {
  Avatar,
  Banner,
  Button,
  EmptyState,
  Icon,
  ScreenHeader,
  Skeleton,
} from "../ui/components";
import { colors, radius, space, STATUS, type } from "../ui/theme";

const STATUS_FILTERS = ["All", "Open", "In Progress", "Resolved"];

const newestFirst = (a, b) => new Date(b.created_at || b.createdAt) - new Date(a.created_at || a.createdAt);

/** A filter pill; selected pills are filled. */
const Pill = ({ label, count, icon, selected, onPress, testID, dot }) => (
  <Pressable
    onPress={onPress}
    testID={testID}
    accessibilityRole="button"
    accessibilityState={{ selected }}
    android_ripple={{ color: "rgba(15,23,42,0.06)", borderless: false }}
    style={[styles.pill, selected && styles.pillSelected]}
  >
    {dot ? <View style={[styles.pillDot, { backgroundColor: selected ? "#ffffff" : dot }]} /> : null}
    {icon ? <Icon name={icon} size={16} color={selected ? "#ffffff" : colors.ink2} /> : null}
    <Text style={[styles.pillText, selected && styles.pillTextSelected]}>{label}</Text>
    {count !== undefined ? (
      <Text style={[styles.pillCount, selected && styles.pillCountSelected]}>{count}</Text>
    ) : null}
  </Pressable>
);

const LoadingList = () => (
  <View style={styles.skeletons}>
    {[0, 1].map((key) => (
      <View key={key} style={styles.skeletonCard}>
        <Skeleton style={styles.skeletonPhoto} />
        <View style={styles.skeletonBody}>
          <Skeleton style={{ width: 90, height: 20, borderRadius: 10 }} />
          <Skeleton style={{ width: "80%", height: 18 }} />
          <Skeleton style={{ width: "95%", height: 14 }} />
          <Skeleton style={{ width: "60%", height: 14 }} />
        </View>
      </View>
    ))}
  </View>
);

// Lists all reports, or with `mine` only the signed-in citizen's own
// ("My reports" tab).
const HomeScreen = ({ navigation, mine = false }) => {
  const { user } = useAuth();
  const categories = useCategories();
  const [issues, setIssues] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [oldestFirst, setOldestFirst] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get("/api/issues", { params: mine ? { mine: "true" } : {} });
      setIssues(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoaded(true);
      setRefreshing(false);
    }
  }, [mine]);

  // Reload whenever the tab is shown, so new reports and status changes appear.
  useFocusEffect(
    useCallback(() => {
      fetchIssues();
    }, [fetchIssues])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchIssues();
  };

  const counts = useMemo(() => {
    const byStatus = { All: issues.length };
    issues.forEach((issue) => {
      byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    });
    return byStatus;
  }, [issues]);

  const visible = useMemo(() => {
    const filtered = issues.filter(
      (issue) =>
        (statusFilter === "All" || issue.status === statusFilter) &&
        (categoryFilter === "all" || (issue.category || "other") === categoryFilter)
    );
    const sorted = [...filtered].sort(newestFirst);
    return oldestFirst ? sorted.reverse() : sorted;
  }, [issues, statusFilter, categoryFilter, oldestFirst]);

  const filtering = statusFilter !== "All" || categoryFilter !== "all";
  const firstName = user?.name?.split(" ")[0] || "there";

  const header = (
    <View>
      <ScreenHeader
        title={mine ? "My reports" : `Hello, ${firstName}`}
        subtitle={
          mine
            ? loaded
              ? `${issues.length} report${issues.length === 1 ? "" : "s"} you have made`
              : "Reports you have made"
            : "Problems reported in your community"
        }
        right={
          mine ? null : (
            <Pressable onPress={() => navigation.navigate("Profile")} accessibilityLabel="Your profile" hitSlop={6}>
              <Avatar name={user?.name} size={42} />
            </Pressable>
          )
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
        {STATUS_FILTERS.map((status) => (
          <Pill
            key={status}
            label={status === "All" ? "All" : STATUS[status].label}
            count={counts[status] || 0}
            dot={status === "All" ? null : STATUS[status].color}
            selected={statusFilter === status}
            onPress={() => setStatusFilter(status)}
            testID={`filter-status-${status.toLowerCase().replace(" ", "-")}`}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.pillRow, styles.categoryRow]}>
        {[{ id: "all", label: "All categories" }, ...categories].map((category) => (
          <Pill
            key={category.id}
            label={category.label}
            icon={category.id === "all" ? "shape-outline" : CATEGORY_ICONS[category.id]}
            selected={categoryFilter === category.id}
            onPress={() => setCategoryFilter(category.id)}
            testID={`filter-category-${category.id}`}
          />
        ))}
      </ScrollView>

      {loaded && !error && visible.length ? (
        <View style={styles.resultsRow}>
          <Text style={type.caption}>
            {visible.length} {visible.length === 1 ? "report" : "reports"}
          </Text>
          <Pressable
            onPress={() => setOldestFirst(!oldestFirst)}
            style={styles.sort}
            hitSlop={8}
            accessibilityRole="button"
            testID="sort-toggle"
          >
            <Icon name="swap-vertical" size={16} color={colors.ink2} />
            <Text style={styles.sortText}>{oldestFirst ? "Oldest first" : "Newest first"}</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? (
        <View style={styles.errorBox}>
          <Banner tone="error">{`Could not load reports. ${error}`}</Banner>
          <Button variant="secondary" title="Try again" icon="refresh" onPress={onRefresh} compact />
        </View>
      ) : null}
    </View>
  );

  const empty = !loaded ? (
    <LoadingList />
  ) : error ? null : filtering ? (
    <EmptyState
      icon="filter-variant-remove"
      title="No reports match these filters"
      body="Try another status or category."
      action={
        <Button
          variant="secondary"
          title="Clear filters"
          onPress={() => {
            setStatusFilter("All");
            setCategoryFilter("all");
          }}
        />
      }
    />
  ) : mine ? (
    <EmptyState
      icon="file-document-outline"
      title="You haven't reported anything yet."
      body="When you report a problem, you can follow it here until it is fixed."
      action={<Button title="Report a problem" icon="camera-outline" onPress={() => navigation.navigate("Report")} />}
    />
  ) : (
    <EmptyState
      icon="map-marker-check-outline"
      title="No reports yet"
      body="Problems reported in your area will appear here."
    />
  );

  return (
    <FlatList
      style={styles.screen}
      data={loaded && !error ? visible : []}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={styles.cardWrap}>
          <IssueCard issue={item} onPress={() => navigation.navigate("IssueDetail", { issueId: item.id })} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.brand]} />}
      showsVerticalScrollIndicator={false}
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  list: { paddingBottom: space.xxl },
  cardWrap: { paddingHorizontal: space.lg },

  pillRow: { paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.xs },
  categoryRow: { paddingTop: space.sm + 2 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  pillSelected: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillDot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontSize: 14, fontWeight: "500", color: colors.ink2 },
  pillTextSelected: { color: "#ffffff" },
  pillCount: { fontSize: 13, fontWeight: "600", color: colors.faint },
  pillCountSelected: { color: "rgba(255,255,255,0.7)" },

  resultsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space.xl,
    paddingTop: space.lg + 2,
    paddingBottom: space.md,
  },
  sort: { flexDirection: "row", alignItems: "center", gap: 4 },
  sortText: { fontSize: 13, fontWeight: "600", color: colors.ink2 },

  errorBox: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md },

  skeletons: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: space.md + 2 },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
  },
  skeletonPhoto: { width: "100%", aspectRatio: 16 / 9, borderRadius: 0 },
  skeletonBody: { padding: space.lg, gap: space.md },
});

export default HomeScreen;

export const MyReportsScreen = (props) => <HomeScreen {...props} mine />;
