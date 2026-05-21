import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Listing } from '../services/api';
import { dismissListing } from '../services/api';

interface ListingCardProps {
  listing: Listing;
  onDismiss?: (id: string) => void;
}

const MARKETPLACE_COLORS: Record<Listing['marketplace'], string> = {
  ebay: '#F97316',
  reddit: '#FF4500',
  chrono24: '#3B82F6',
  facebook: '#1877F2',
};

const MARKETPLACE_LABELS: Record<Listing['marketplace'], string> = {
  ebay: 'eBay',
  reddit: 'Reddit',
  chrono24: 'Chrono24',
  facebook: 'Facebook',
};

const MARKETPLACE_ICONS: Record<Listing['marketplace'], string> = {
  ebay: '🛍️',
  reddit: '👾',
  chrono24: '⌚',
  facebook: '📘',
};

function getRelativeTime(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  if (diffHours > 0) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffMinutes > 0) return diffMinutes === 1 ? '1 min ago' : `${diffMinutes} mins ago`;
  return 'Just now';
}

export default function ListingCard({ listing, onDismiss }: ListingCardProps) {
  const accentColor = MARKETPLACE_COLORS[listing.marketplace];

  const handlePress = async () => {
    try {
      const canOpen = await Linking.canOpenURL(listing.url);
      if (canOpen) {
        await Linking.openURL(listing.url);
      } else {
        Alert.alert('Cannot open link', 'The listing URL could not be opened.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open the listing URL.');
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissListing(listing.id);
      onDismiss?.(listing.id);
    } catch {
      // Optimistically removed — silently fail
      onDismiss?.(listing.id);
    }
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Dismiss button */}
      <TouchableOpacity
        style={styles.dismissButton}
        onPress={handleDismiss}
        hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
      >
        <Text style={styles.dismissIcon}>✕</Text>
      </TouchableOpacity>

      <View style={styles.row}>
        {/* Thumbnail */}
        <View style={styles.thumbnailContainer}>
          {listing.image_url ? (
            <Image
              source={{ uri: listing.image_url }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.thumbnailPlaceholder, { borderColor: accentColor }]}>
              <Text style={styles.thumbnailIcon}>
                {MARKETPLACE_ICONS[listing.marketplace]}
              </Text>
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2} ellipsizeMode="tail">
            {listing.title}
          </Text>

          {listing.price !== undefined && listing.price !== null ? (
            <Text style={styles.price}>${listing.price.toLocaleString()}</Text>
          ) : null}

          <View style={styles.meta}>
            <View style={[styles.marketplaceBadge, { backgroundColor: accentColor }]}>
              <Text style={styles.marketplaceText}>
                {MARKETPLACE_LABELS[listing.marketplace]}
              </Text>
            </View>

            <Text style={styles.time}>{getRelativeTime(listing.found_at)}</Text>
          </View>

          {listing.seller ? (
            <Text style={styles.seller} numberOfLines={1}>
              by {listing.seller}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
    position: 'relative',
  },
  dismissButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 1,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissIcon: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 28,
  },
  thumbnailContainer: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    flexShrink: 0,
  },
  thumbnail: {
    width: 80,
    height: 80,
  },
  thumbnailPlaceholder: {
    width: 80,
    height: 80,
    backgroundColor: '#0F172A',
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailIcon: {
    fontSize: 28,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
    lineHeight: 20,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: '#22C55E',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  marketplaceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  marketplaceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  time: {
    color: '#94A3B8',
    fontSize: 12,
  },
  seller: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
