import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  getScouts,
  getScoutListings,
  runScout,
  Scout,
  Listing,
} from '../../../services/api';
import ListingCard from '../../../components/ListingCard';

type MarketplaceFilter = 'all' | 'ebay' | 'reddit' | 'chrono24' | 'facebook';

const FILTER_OPTIONS: { key: MarketplaceFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ebay', label: 'eBay' },
  { key: 'reddit', label: 'Reddit' },
  { key: 'chrono24', label: 'Chrono24' },
  { key: 'facebook', label: 'Facebook' },
];

const PAGE_SIZE = 20;

export default function ScoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();

  const [scout, setScout] = useState<Scout | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [activeFilter, setActiveFilter] = useState<MarketplaceFilter>('all');
  const [page, setPage] = useState(1);
  const [totalListings, setTotalListings] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState('');

  const loadListings = useCallback(
    async (pageNum: number, filter: MarketplaceFilter, refresh = false) => {
      if (!id) return;
      try {
        const params: { page: number; limit: number; marketplace?: string } = {
          page: pageNum,
          limit: PAGE_SIZE,
        };
        if (filter !== 'all') {
          params.marketplace = filter;
        }
        const result = await getScoutListings(id, params);
        if (refresh || pageNum === 1) {
          setListings(result.listings);
        } else {
          setListings((prev) => [...prev, ...result.listings]);
        }
        setTotalListings(result.total);
        setError('');
      } catch {
        setError('Failed to load listings.');
      }
    },
    [id]
  );

  const loadScoutDetails = useCallback(async () => {
    if (!id) return;
    try {
      const allScouts = await getScouts();
      const found = allScouts.find((s) => s.id === id);
      if (found) setScout(found);
    } catch {
      // Non-fatal
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      await Promise.all([loadScoutDetails(), loadListings(1, 'all', true)]);
      setIsLoading(false);
    };
    init();
  }, [loadScoutDetails, loadListings]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPage(1);
    await Promise.all([loadScoutDetails(), loadListings(1, activeFilter, true)]);
    setIsRefreshing(false);
  };

  const handleFilterChange = async (filter: MarketplaceFilter) => {
    setActiveFilter(filter);
    setPage(1);
    setIsLoading(true);
    await loadListings(1, filter, true);
    setIsLoading(false);
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || listings.length >= totalListings) return;
    const nextPage = page + 1;
    setIsLoadingMore(true);
    setPage(nextPage);
    await loadListings(nextPage, activeFilter);
    setIsLoadingMore(false);
  };

  const handleRunNow = async () => {
    if (!id || isRunning) return;
    setIsRunning(true);
    try {
      await runScout(id);
      Alert.alert('Scout Running', 'Your scout is searching the marketplaces now. Results will appear shortly.');
    } catch {
      Alert.alert('Error', 'Failed to run scout. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleEdit = () => {
    router.push(`/(app)/scout/create?edit=${id}`);
  };

  const handleDismiss = (listingId: string) => {
    setListings((prev) => prev.filter((l) => l.id !== listingId));
    setTotalListings((prev) => Math.max(0, prev - 1));
  };

  const priceRangeText = () => {
    if (!scout) return null;
    const { min_price, max_price } = scout;
    if (min_price !== undefined && max_price !== undefined) {
      return `$${min_price.toLocaleString()} – $${max_price.toLocaleString()}`;
    }
    if (min_price !== undefined) return `From $${min_price.toLocaleString()}`;
    if (max_price !== undefined) return `Up to $${max_price.toLocaleString()}`;
    return null;
  };

  const priceRange = priceRangeText();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {scout?.name ?? 'Scout'}
        </Text>
        <TouchableOpacity onPress={handleEdit} style={styles.editButton} activeOpacity={0.7}>
          <Text style={styles.editText}>Edit</Text>
        </TouchableOpacity>
      </View>

      {isLoading && !isRefreshing ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
        </View>
      ) : (
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
          ListHeaderComponent={
            <>
              {/* Scout summary */}
              {scout && (
                <View style={styles.summaryCard}>
                  {scout.keywords.length > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Keywords</Text>
                      <View style={styles.keywordsWrap}>
                        {scout.keywords.map((kw) => (
                          <View key={kw} style={styles.kwChip}>
                            <Text style={styles.kwChipText}>{kw}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                  {priceRange && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Price</Text>
                      <Text style={styles.summaryValue}>{priceRange}</Text>
                    </View>
                  )}
                  {scout.marketplaces.length > 0 && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Marketplaces</Text>
                      <Text style={styles.summaryValue}>
                        {scout.marketplaces.join(', ')}
                      </Text>
                    </View>
                  )}
                  <TouchableOpacity
                    style={[styles.runButton, isRunning && styles.runButtonDisabled]}
                    onPress={handleRunNow}
                    disabled={isRunning}
                    activeOpacity={0.8}
                  >
                    {isRunning ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.runButtonText}>▶ Run Now</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Error */}
              {error ? (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              {/* Filter bar */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterBar}
                contentContainerStyle={styles.filterBarContent}
              >
                {FILTER_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.filterPill,
                      activeFilter === opt.key && styles.filterPillActive,
                    ]}
                    onPress={() => handleFilterChange(opt.key)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        activeFilter === opt.key && styles.filterPillTextActive,
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.resultsCount}>
                {totalListings} {totalListings === 1 ? 'find' : 'finds'}
              </Text>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No findings yet</Text>
              <Text style={styles.emptySubtitle}>
                Hit "Run Now" to search, or wait for the next scheduled scan.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
              </View>
            ) : null
          }
        />
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  backButton: {
    marginRight: 8,
  },
  backIcon: {
    fontSize: 28,
    color: '#6366F1',
    fontWeight: '300',
    lineHeight: 32,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  editButton: {
    paddingLeft: 12,
  },
  editText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  summaryRow: {
    gap: 4,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 14,
    color: '#F8FAFC',
  },
  keywordsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  kwChip: {
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  kwChipText: {
    color: '#6366F1',
    fontSize: 12,
    fontWeight: '600',
  },
  runButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  runButtonDisabled: {
    opacity: 0.6,
  },
  runButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
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
  filterBar: {
    marginBottom: 8,
  },
  filterBarContent: {
    gap: 8,
    paddingRight: 4,
  },
  filterPill: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterPillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  filterPillText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  resultsCount: {
    color: '#475569',
    fontSize: 12,
    marginBottom: 8,
  },
  emptyContainer: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  loadMoreContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
});
