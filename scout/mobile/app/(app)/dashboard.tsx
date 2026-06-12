import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getListings, getScouts, Listing, Scout } from '../../services/api';
import ListingCard from '../../components/ListingCard';

const PAGE_SIZE = 20;

export default function DashboardScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [listings, setListings] = useState<Listing[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [page, setPage] = useState(1);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const activeScoutsCount = scouts.filter((s) => s.active).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const findsToday = listings.filter(
    (l) => new Date(l.found_at) >= todayStart
  ).length;

  const loadData = useCallback(async (pageNum: number, refresh = false) => {
    try {
      const [listingsRes, scoutsRes] = await Promise.all([
        getListings({ page: pageNum, limit: PAGE_SIZE }),
        getScouts(),
      ]);
      if (refresh || pageNum === 1) {
        setListings(listingsRes.listings);
      } else {
        setListings((prev) => [...prev, ...listingsRes.listings]);
      }
      setTotalListings(listingsRes.total);
      setScouts(scoutsRes);
      setError('');
    } catch {
      setError('Failed to load data. Pull to refresh.');
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await loadData(1, true);
      setIsLoading(false);
    };
    init();
  }, [loadData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPage(1);
    await loadData(1, true);
    setIsRefreshing(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || listings.length >= totalListings) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    setPage(nextPage);
    await loadData(nextPage);
    setIsLoadingMore(false);
  };

  const handleDismiss = (id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
    setTotalListings((prev) => Math.max(0, prev - 1));
  };

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const emailName = user?.email?.split('@')[0] ?? 'there';

  if (isLoading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>Scout</Text>
        <Text style={styles.greeting}>
          {greeting()}, {emailName}
        </Text>
      </View>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{activeScoutsCount}</Text>
          <Text style={styles.statLabel}>Active Scouts</Text>
        </View>
        <View style={[styles.statCard, styles.statCardRight]}>
          <Text style={styles.statValue}>{findsToday}</Text>
          <Text style={styles.statLabel}>Finds Today</Text>
        </View>
      </View>

      {/* Error banner */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Recent Finds */}
      <Text style={styles.sectionTitle}>Recent Finds</Text>

      <FlatList
        data={listings}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ListingCard listing={item} onDismiss={handleDismiss} />
        )}
        contentContainerStyle={[
          styles.listContent,
          listings.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>Your scouts are watching.</Text>
            <Text style={styles.emptySubtitle}>
              Finds will appear here.
            </Text>
          </View>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadMoreContainer}>
              <ActivityIndicator size="small" color="#6366F1" />
            </View>
          ) : listings.length > 0 && listings.length >= totalListings ? (
            <View style={styles.loadMoreContainer}>
              <Text style={styles.allLoadedText}>All caught up</Text>
            </View>
          ) : null
        }
      />

      {listings.length > 0 && listings.length < totalListings && !isLoadingMore && (
        <TouchableOpacity style={styles.loadMoreButton} onPress={handleLoadMore}>
          <Text style={styles.loadMoreButtonText}>
            Load More ({totalListings - listings.length} remaining)
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  centered: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366F1',
    letterSpacing: -0.5,
  },
  greeting: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
  },
  statCardRight: {},
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  statLabel: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 4,
    textAlign: 'center',
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#450A0A',
    borderWidth: 1,
    borderColor: '#7F1D1D',
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 8,
    textAlign: 'center',
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  allLoadedText: {
    color: '#475569',
    fontSize: 13,
  },
  loadMoreButton: {
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  loadMoreButtonText: {
    color: '#6366F1',
    fontSize: 14,
    fontWeight: '600',
  },
});
