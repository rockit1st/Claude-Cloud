import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import {
  getScouts,
  createScout,
  updateScout,
  CreateScoutData,
} from '../../../services/api';
import MarketplaceSelector from '../../../components/MarketplaceSelector';

const KEYWORD_COLORS = [
  '#6366F1',
  '#8B5CF6',
  '#0EA5E9',
  '#14B8A6',
  '#F59E0B',
];

export default function CreateScoutScreen() {
  const insets = useSafeAreaInsets();
  const { edit: editId } = useLocalSearchParams<{ edit?: string }>();
  const isEditing = Boolean(editId);

  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [marketplaces, setMarketplaces] = useState<string[]>(['ebay', 'reddit', 'chrono24', 'facebook']);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [active, setActive] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingEdit, setIsFetchingEdit] = useState(isEditing);
  const [error, setError] = useState('');

  const keywordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!editId) return;
    const fetchScout = async () => {
      setIsFetchingEdit(true);
      try {
        const all = await getScouts();
        const found = all.find((s) => s.id === editId);
        if (found) {
          setName(found.name);
          setKeywords(found.keywords);
          setMinPrice(found.min_price !== undefined ? String(found.min_price) : '');
          setMaxPrice(found.max_price !== undefined ? String(found.max_price) : '');
          setMarketplaces(found.marketplaces);
          setNotificationsEnabled(found.notifications_enabled);
          setActive(found.active);
        }
      } catch {
        Alert.alert('Error', 'Failed to load scout data.');
      } finally {
        setIsFetchingEdit(false);
      }
    };
    fetchScout();
  }, [editId]);

  const addKeyword = (raw: string) => {
    const cleaned = raw.trim().replace(/[,\s]+$/, '').trim();
    if (cleaned.length === 0) return;
    if (!keywords.includes(cleaned)) {
      setKeywords((prev) => [...prev, cleaned]);
    }
    setKeywordInput('');
  };

  const handleKeywordInputChange = (text: string) => {
    // If user typed a delimiter, add the keyword
    if (text.endsWith(' ') || text.endsWith(',')) {
      addKeyword(text);
    } else {
      setKeywordInput(text);
    }
  };

  const handleKeywordSubmit = () => {
    addKeyword(keywordInput);
  };

  const removeKeyword = (kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  };

  const validate = (): boolean => {
    if (!name.trim()) {
      setError('Please enter a scout name.');
      return false;
    }
    if (keywords.length === 0) {
      setError('Please add at least one keyword.');
      return false;
    }
    if (marketplaces.length === 0) {
      setError('Please select at least one marketplace.');
      return false;
    }
    const minNum = minPrice ? parseFloat(minPrice) : undefined;
    const maxNum = maxPrice ? parseFloat(maxPrice) : undefined;
    if (minNum !== undefined && isNaN(minNum)) {
      setError('Min price must be a valid number.');
      return false;
    }
    if (maxNum !== undefined && isNaN(maxNum)) {
      setError('Max price must be a valid number.');
      return false;
    }
    if (minNum !== undefined && maxNum !== undefined && minNum > maxNum) {
      setError('Min price cannot be greater than max price.');
      return false;
    }
    setError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setIsLoading(true);

    const data: CreateScoutData = {
      name: name.trim(),
      keywords,
      marketplaces,
      active,
      notifications_enabled: notificationsEnabled,
    };

    if (minPrice.trim()) data.min_price = parseFloat(minPrice);
    if (maxPrice.trim()) data.max_price = parseFloat(maxPrice);

    try {
      if (isEditing && editId) {
        await updateScout(editId, data);
      } else {
        await createScout(data);
      }
      router.back();
    } catch {
      setError(isEditing ? 'Failed to update scout.' : 'Failed to create scout.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetchingEdit) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={[styles.container, { paddingTop: insets.top }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Scout' : 'New Scout'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : (
              <Text style={styles.saveText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Scout Name */}
        <View style={styles.field}>
          <Text style={styles.label}>Scout Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Vintage Camera Deal Finder"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoCorrect={false}
            maxLength={80}
          />
        </View>

        {/* Keywords */}
        <View style={styles.field}>
          <Text style={styles.label}>Keywords</Text>
          <Text style={styles.fieldHint}>
            Type a keyword and press space, comma, or return to add.
          </Text>
          {keywords.length > 0 && (
            <View style={styles.chipsContainer}>
              {keywords.map((kw, index) => (
                <TouchableOpacity
                  key={kw}
                  style={[
                    styles.keywordChip,
                    { borderColor: KEYWORD_COLORS[index % KEYWORD_COLORS.length] },
                  ]}
                  onPress={() => removeKeyword(kw)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.keywordChipText,
                      { color: KEYWORD_COLORS[index % KEYWORD_COLORS.length] },
                    ]}
                  >
                    {kw} ✕
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
          <TextInput
            ref={keywordInputRef}
            style={styles.input}
            placeholder="e.g. Leica, film camera, vintage..."
            placeholderTextColor="#475569"
            value={keywordInput}
            onChangeText={handleKeywordInputChange}
            onSubmitEditing={handleKeywordSubmit}
            returnKeyType="done"
            blurOnSubmit={false}
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        {/* Price Range */}
        <View style={styles.field}>
          <Text style={styles.label}>Price Range (optional)</Text>
          <View style={styles.priceRow}>
            <View style={styles.priceField}>
              <Text style={styles.pricePrefix}>Min $</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="0"
                placeholderTextColor="#475569"
                value={minPrice}
                onChangeText={setMinPrice}
                keyboardType="decimal-pad"
              />
            </View>
            <Text style={styles.priceSeparator}>–</Text>
            <View style={styles.priceField}>
              <Text style={styles.pricePrefix}>Max $</Text>
              <TextInput
                style={[styles.input, styles.priceInput]}
                placeholder="No limit"
                placeholderTextColor="#475569"
                value={maxPrice}
                onChangeText={setMaxPrice}
                keyboardType="decimal-pad"
              />
            </View>
          </View>
        </View>

        {/* Marketplaces */}
        <View style={styles.field}>
          <Text style={styles.label}>Marketplaces</Text>
          <MarketplaceSelector
            selected={marketplaces}
            onChange={setMarketplaces}
          />
        </View>

        {/* Notifications toggle */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleTitle}>Notifications</Text>
              <Text style={styles.toggleSubtitle}>
                Get push notifications for new finds
              </Text>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#334155', true: '#6366F1' }}
              thumbColor={notificationsEnabled ? '#FFFFFF' : '#94A3B8'}
              ios_backgroundColor="#334155"
            />
          </View>
        </View>

        {/* Active toggle */}
        <View style={styles.field}>
          <View style={styles.toggleRow}>
            <View style={styles.toggleContent}>
              <Text style={styles.toggleTitle}>Active</Text>
              <Text style={styles.toggleSubtitle}>
                Scout searches when active
              </Text>
            </View>
            <Switch
              value={active}
              onValueChange={setActive}
              trackColor={{ false: '#334155', true: '#6366F1' }}
              thumbColor={active ? '#FFFFFF' : '#94A3B8'}
              ios_backgroundColor="#334155"
            />
          </View>
        </View>

        {/* Save button */}
        <TouchableOpacity
          style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>
              {isEditing ? 'Save Changes' : 'Create Scout'}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
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
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 4,
  },
  cancelText: {
    color: '#94A3B8',
    fontSize: 15,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  saveText: {
    color: '#6366F1',
    fontSize: 15,
    fontWeight: '700',
  },
  errorContainer: {
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
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  fieldHint: {
    fontSize: 12,
    color: '#475569',
    marginTop: -4,
  },
  input: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    padding: 14,
    color: '#F8FAFC',
    fontSize: 15,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordChip: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  keywordChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priceField: {
    flex: 1,
    gap: 4,
  },
  pricePrefix: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
  },
  priceInput: {
    flex: 1,
  },
  priceSeparator: {
    color: '#475569',
    fontSize: 18,
    paddingTop: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleContent: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    fontSize: 15,
    color: '#F8FAFC',
    fontWeight: '600',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
