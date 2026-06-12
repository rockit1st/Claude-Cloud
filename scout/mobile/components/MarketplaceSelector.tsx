import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';

export type MarketplaceId = 'ebay' | 'reddit' | 'chrono24' | 'facebook';

interface Marketplace {
  id: MarketplaceId;
  label: string;
  icon: string;
}

const MARKETPLACES: Marketplace[] = [
  { id: 'ebay', label: 'eBay', icon: '🛍️' },
  { id: 'reddit', label: 'Reddit', icon: '👾' },
  { id: 'chrono24', label: 'Chrono24', icon: '⌚' },
  { id: 'facebook', label: 'Facebook', icon: '📘' },
];

interface MarketplaceSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export default function MarketplaceSelector({
  selected,
  onChange,
}: MarketplaceSelectorProps) {
  const toggle = (id: MarketplaceId) => {
    if (selected.includes(id)) {
      onChange(selected.filter((m) => m !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <View style={styles.container}>
      {MARKETPLACES.map((mp) => {
        const isActive = selected.includes(mp.id);
        return (
          <TouchableOpacity
            key={mp.id}
            style={[styles.pill, isActive && styles.pillActive]}
            onPress={() => toggle(mp.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.pillIcon}>{mp.icon}</Text>
            <Text style={[styles.pillLabel, isActive && styles.pillLabelActive]}>
              {mp.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillActive: {
    backgroundColor: '#6366F1',
    borderColor: '#6366F1',
  },
  pillIcon: {
    fontSize: 14,
  },
  pillLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  pillLabelActive: {
    color: '#FFFFFF',
  },
});
