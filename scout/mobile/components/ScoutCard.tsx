import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Scout, updateScout } from '../services/api';

interface ScoutCardProps {
  scout: Scout;
  onUpdate: (updated: Scout) => void;
}

const MARKETPLACE_ICONS: Record<string, string> = {
  ebay: '🛍️',
  reddit: '👾',
  chrono24: '⌚',
  facebook: '📘',
};

const MARKETPLACE_LABELS: Record<string, string> = {
  ebay: 'eBay',
  reddit: 'Reddit',
  chrono24: 'Chrono24',
  facebook: 'Facebook',
};

const KEYWORD_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#0EA5E9',
  '#14B8A6',
  '#F59E0B',
];

export default function ScoutCard({ scout, onUpdate }: ScoutCardProps) {
  const handlePress = () => {
    router.push(`/(app)/scout/${scout.id}`);
  };

  const handleActiveToggle = async (value: boolean) => {
    try {
      const updated = await updateScout(scout.id, { active: value });
      onUpdate(updated);
    } catch {
      Alert.alert('Error', 'Failed to update scout status.');
    }
  };

  const handleNotificationToggle = async (value: boolean) => {
    try {
      const updated = await updateScout(scout.id, { notifications_enabled: value });
      onUpdate(updated);
    } catch {
      Alert.alert('Error', 'Failed to update notification setting.');
    }
  };

  const priceRange = () => {
    const { min_price, max_price } = scout;
    if (min_price !== undefined && max_price !== undefined) {
      return `$${min_price.toLocaleString()} – $${max_price.toLocaleString()}`;
    }
    if (min_price !== undefined) {
      return `From $${min_price.toLocaleString()}`;
    }
    if (max_price !== undefined) {
      return `Up to $${max_price.toLocaleString()}`;
    }
    return null;
  };

  const range = priceRange();

  return (
    <TouchableOpacity
      style={[styles.card, !scout.active && styles.cardInactive]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {/* Name row */}
      <View style={styles.nameRow}>
        <Text style={styles.name} numberOfLines={1}>
          {scout.name}
        </Text>
        <View style={styles.togglesRow}>
          {/* Notification bell toggle */}
          <TouchableOpacity
            onPress={() => handleNotificationToggle(!scout.notifications_enabled)}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
            style={styles.bellButton}
          >
            <Text style={[styles.bellIcon, !scout.notifications_enabled && styles.bellIconOff]}>
              {scout.notifications_enabled ? '🔔' : '🔕'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Keywords chips */}
      {scout.keywords.length > 0 && (
        <View style={styles.chipsRow}>
          {scout.keywords.slice(0, 6).map((kw, index) => (
            <View
              key={kw}
              style={[
                styles.chip,
                { borderColor: KEYWORD_COLORS[index % KEYWORD_COLORS.length] },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: KEYWORD_COLORS[index % KEYWORD_COLORS.length] },
                ]}
              >
                {kw}
              </Text>
            </View>
          ))}
          {scout.keywords.length > 6 && (
            <Text style={styles.moreKeywords}>+{scout.keywords.length - 6}</Text>
          )}
        </View>
      )}

      {/* Price range */}
      {range ? (
        <View style={styles.priceRow}>
          <Text style={styles.priceIcon}>💰</Text>
          <Text style={styles.priceText}>{range}</Text>
        </View>
      ) : null}

      {/* Marketplaces */}
      {scout.marketplaces.length > 0 && (
        <View style={styles.marketplacesRow}>
          {scout.marketplaces.map((mp) => (
            <View key={mp} style={styles.marketplacePill}>
              <Text style={styles.marketplaceIcon}>
                {MARKETPLACE_ICONS[mp] ?? '🛒'}
              </Text>
              <Text style={styles.marketplaceLabel}>
                {MARKETPLACE_LABELS[mp] ?? mp}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Footer row: Active toggle */}
      <View style={styles.footer}>
        <Text style={styles.activeLabel}>Active</Text>
        <Switch
          value={scout.active}
          onValueChange={handleActiveToggle}
          trackColor={{ false: '#334155', true: '#6366F1' }}
          thumbColor={scout.active ? '#FFFFFF' : '#94A3B8'}
          ios_backgroundColor="#334155"
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  cardInactive: {
    opacity: 0.6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    flex: 1,
    marginRight: 8,
  },
  togglesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bellButton: {
    padding: 4,
  },
  bellIcon: {
    fontSize: 18,
  },
  bellIconOff: {
    opacity: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  moreKeywords: {
    color: '#94A3B8',
    fontSize: 12,
    alignSelf: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  priceIcon: {
    fontSize: 14,
  },
  priceText: {
    color: '#22C55E',
    fontSize: 13,
    fontWeight: '600',
  },
  marketplacesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  marketplacePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#0F172A',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  marketplaceIcon: {
    fontSize: 12,
  },
  marketplaceLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  activeLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
